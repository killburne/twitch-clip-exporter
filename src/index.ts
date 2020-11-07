import {ClientCredentialsAuthProvider} from 'twitch-auth';
import {ApiClient, HelixPaginatedRequest, HelixUser} from 'twitch';
import * as util from 'util';
import * as fs from 'fs';
import * as cliProgress from 'cli-progress';
import {prompt} from 'enquirer';
import axios from 'axios';
import {createObjectCsvWriter} from 'csv-writer';

const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

interface TwitchConfig {
    clientId: string;
    clientSecret: string;
}

const configFile = 'twitch.json';

async function readTwitchConfig(): Promise<TwitchConfig | null> {
    try {
        const data = await readFile(configFile, {encoding: 'utf8'});
        const parsed = JSON.parse(data) as TwitchConfig;
        if (parsed?.clientId && parsed?.clientSecret) {
            return parsed;
        }
    } catch (e) {
    }
    return null;
}

async function writeTwitchConfig(conf: TwitchConfig) {
    try {
        console.log(`Saving Client-ID and Client-Secret to ${configFile}`);
        await writeFile(configFile, JSON.stringify(conf));
    } catch (e) {
        console.warn(`Failed to save config to ${configFile}`)
    }
}

async function promptTwitchConf(): Promise<TwitchConfig> {
    do {
        const res = await prompt<TwitchConfig>([
            {
                type: 'input',
                name: 'clientId',
                message: 'Twitch Client-ID'
            },
            {
                type: 'input',
                name: 'clientSecret',
                message: 'Twitch Client-Secret'
            }
        ]);
        if (res?.clientId && res?.clientSecret) {
            return res;
        }
    } while (true);
}

(async () => {
    let api: ApiClient | null = null;
    let twitchConf: TwitchConfig | null = await readTwitchConfig();
    do {
        if (!twitchConf?.clientId || !twitchConf?.clientSecret) {
            twitchConf = await promptTwitchConf();
        }

        const authProvider = new ClientCredentialsAuthProvider(twitchConf!.clientId, twitchConf!.clientSecret);
        try {
            await authProvider.getAccessToken();
        } catch (e) {
            console.error('Your provided Client-ID and/or Client-Secret don\'t seem to be correct');
            twitchConf = null;
            continue;
        }

        await writeTwitchConfig(twitchConf);
        api = new ApiClient({authProvider});
    } while (!api);

    let user: HelixUser | null;
    do {
        const res = await prompt<{ streamer: string }>({
            type: 'input',
            name: 'streamer',
            message: 'Streamer name?'
        });
        user = await api.helix.users.getUserByName(res.streamer);
        if (!user) {
            console.log(`Are you sure "${res.streamer}" exists?`);
        }
    } while (!user);

    const data = await api.helix.clips.getClipsForBroadcasterPaginated(user.id, {
        limit: 100
    });

    if (!(data instanceof HelixPaginatedRequest)) {
        console.error('Failed to fetch clips');
        process.exit(1);
    }

    const clips = await data.getAll();

    const backupDir = `clips-${user.name}`;
    const clipDir = `${backupDir}/videos`;

    await mkdir(clipDir, {recursive: true});

    const indexCsv = createObjectCsvWriter({
        path: `${backupDir}/index.csv`,
        alwaysQuote: true,
        fieldDelimiter: ';',
        header: [
            {id: 'file', title: 'File'},
            {id: 'title', title: 'Title'},
            {id: 'viewCount', title: 'View Count'},
            {id: 'creatorName', title: 'Creator Name'},
            {id: 'createdAt', title: 'Created at'}
        ]
    });

    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(clips.length, 0);

    for (const clip of clips) {
        progress.increment();

        const downloadUrl = clip.thumbnailUrl.replace(/-preview-.+$/, '.mp4');
        const mp4 = await axios.get(downloadUrl, {
            responseType: 'arraybuffer'
        });

        await writeFile(`${clipDir}/${clip.id}.mp4`, mp4.data, {
            encoding: 'binary'
        });

        await indexCsv.writeRecords([
            {
                file: clip.id + '.mp4',
                title: clip.title,
                viewCount: clip.views,
                creatorName: clip.creatorDisplayName,
                createdAt: clip.creationDate + ''
            }
        ]);
    }

    progress.stop();

    console.log('Done!');
})();

