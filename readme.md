# Edge Wallet and SDK info server

## Provides various info such as mining fees, server lists, and supported currency/token info

`npm install`

## Build

    npm run build

## Launch API server

    node lib/indexInfo.js

## Launch server using `forever-service`

    sudo forever-service install indexInfo -r [username] --script lib/indexInfo.js  --start

## Restart, stop, delete service

    sudo service indexInfo restart
    sudo service indexInfo stop
    sudo forever-service delete indexInfo

# API calls
