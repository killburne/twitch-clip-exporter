# Twitch Clip Exporter

A simple [Node.js](https://nodejs.org/) script to download every clip of a specific streamer.
It also saves the clip title, creator name, view count and creation date in a csv file.

## Prerequisites

Create an app at https://dev.twitch.tv/console/apps/ and copy the Client-ID and Client-Secret.

## How to run

Download and run the twitch-clip-export.exe in the releases tab.
The application was packaged with [pkg](https://github.com/vercel/pkg).

## How to build and run from source

- Install [Node.js](https://nodejs.org/)
- Download/Clone this repository.
- Run `npm install` in the repository.
- Build the script `npm run build`.
- And finally start it with `npm run start` and follow the prompts.
