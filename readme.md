# Edge Wallet and SDK info server

### Provides various info such as mining fees, server lists, and supported currency/token info

#### Installation

    npm install
    
Install and run CouchDB v1.6 (not yet compatible with 2.x) 
http://docs.couchdb.org/en/1.6.1/install/index.html

#### Build

    npm run build

#### Launch API server

    node lib/indexInfo.js

#### Launch server using `forever-service`

    sudo forever-service install indexInfo -r [username] --script lib/indexInfo.js  --start

#### Restart, stop, delete service

    sudo service indexInfo restart
    sudo service indexInfo stop
    sudo forever-service delete indexInfo

