# Edge <> EOS Name Registration and Activation Server API

### Leverages BTCPay Server, CouchDb, and the EOS Network to register named accounts using any cryptocurrency configured on your BTCPayServer

### Prerequisites

* [NodeJS](https://nodejs.org)
  * The API uses the NodeJS / [ExpressJS](http://expressjs.com/) Frameworks inherently
* A functioning [BTCPay Server](https://github.com/btcpayserver/btcpayserver) with configured Cryptos &amp; Tokens that are synched to their networks
  * [Luna Node Cloud Hosts](https://www.lunanode.com/) offer a [GREAT quick-start BTCPay Server VPS](https://medium.com/@BtcpayServer/launch-btcpay-server-via-web-interface-and-deploy-full-bitcoin-node-lnd-in-less-than-a-minute-dc8bc6f06a3).
  * Manually installing a BTCPay Server seems possible, but many hours have been burned by @chuckwilliams37 with no success
  * There's also a [docker option](https://github.com/btcpayserver/btcpayserver-docker) if you're into that.
* A [CouchDB](http://couchdb.apache.org/) Installation with a DB named "invoice_tx"
  * Install and run [CouchDB v1.6](http://docs.couchdb.org/en/1.6.1/install/index.html) (not yet compatible with 2.x) 
  * This is used to store the requested names, and track payments until at least 1 confirmation
  * It seems to run fine alongside this API on the same machine
  * [Here's an easy setup](https://websiteforstudents.com/install-apache-couchdb-on-ubuntu-16-04-17-10-18-04/) for Ubuntu machines I used (w/ LunaNode)
  * Here's a neat trick to tunnel a remote CouchDB as though it were local (for local setup/testing of API while using remote CouchDB):

        ssh -f -L localhost:15984:127.0.0.1:5984 user@remote_host -N 


#### Installation

    npm install
    mkdir config && cp serverConfig.json.sample ./config/serverConfig.json

Go thorough and edit the `serverConfig.json` file:

```
    {
        "btcpayServerHostName": "mybtcpayserver.mydomain.com", 
```
:boom: Host Name will need to setup SSL Certificates and be available on the interwebs so that the BTCPay Server can safely communicate with it.
```
        "apiPublicDisplayName": "Edge EOS Name Registration and Payment restful API",
        "apiVersionPrefix": "/api/v1",
        "clientPrivateKeyFullPath": "./config/btcpay_client_private.key",
        "merchantPairingDataFullPath": "./config/btcpay_client_merchant_paring.data",
```
:boom: These above full paths are used by the server as read/write destinations with some API key-pairing/generation calls, so be sure that no write issues exist for the API server in order to generate keys & pair appropriately
```
        "btcpayStoreId": "StoreIDFromBTCPayServerAdminConfig",
        "oneTimePairingCode": "pairingCodeFRomBTCPayServerUsedOnceWithPairingCall", 
        "supportedCurrencies":
            {
            "BTC": true,
            "LTC": true,
            "FTC": true,
            "DOGE": false,
            "DASH": false,
            "ETH": false
            },
        "invoiceNotificationURL": "https://this.server.url/api/v1/invoiceNotificationEvent/",
```
:boom: These values above are all used by the BTCPay Server for connecting clients (e.g. your instance of this API server) that are authorized to generate invoices, receive updates on confirmations, expirations, etc. Make sure that this list of currencies is in alignment with the currencies configured on your BTCPay Server!
``` 
        "dbFullpath": "http://admin:couchDBPassword@localhost:5984",
        "btcPayInvoicePropsToSave": [
            "url", "status", "btcPrice", "btcDue", "cryptoInfo", "price", "currency", "invoiceTime", "expirationTime",
            "currentTime", "lowFeeDetected", "rate", "exceptionStatus", "refundAddressRequestPending", 
            "token", "paymentSubtotals", "paymentTotals", "amountPaid", "minerFees", "addresses"
        ],
        "eosCreatorAccountPrivateKey" : "EOSPrivateKeyAssociatedWithPaying/CreatingAccount",
```
:warning::moneybag: You'll need to create an account on the EOS network that is WELL funded with CPU/NET/RAM to pay for & allocate the creation of other accounts. This (`eosCreatorAccountPrivateKey`) is the private key for that creator account. KEEP IT SAFE!
```
        "eosjs" : {
            "chainId": "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906", 
            "httpEndpoint": "https://proxy.eosnode.tools", 
            "expireInSeconds": 60,
            "broadcast": true,
            "debug": false,
            "sign": true
        },
```
:point_up: [EOSJS](https://github.com/EOSIO/eosjs) configs. [Docs here](https://eosio.github.io/eosjs/)
```
        "eosPricingRatesURL" : "https://info1.edgesecure.co:8444/v1/eosPrices",
        "eosAccountActivationStartingBalances" :{
            "ram": "8192",
            "net": "2", 
            "cpu": "10" 
        },
```
:point_up: This is how much ram/net/cpu EACH account will be PRICED and "seeded" with. Actual results will vary depending on fluctuations during transactions.
```
        "cryptoPricing" : {
            "updateFrequencyMs" : 300000,
            "apiKey" : "my-coinmarketcap-pro-api-key",
            "rootPath":  "https://pro-api.coinmarketcap.com/v1",
        "listings": "/cryptocurrency/listings/latest",
        "tickerQuotes": "/ticker/"
        },
```
:point_up: This is your configuration for the [CoinMarketCap Pro API](https://coinmarketcap.com/api/documentation/v1/) for crypto pricing. BTCPay has it's own inbuilt mechanism for pricing tokens, so It's possible that this is not necessary, and is overkill. 
:recycle::point_up: A refactor may be in order here.
:hankey: In any case, the code can be improved.

```
        "serverSSLKeyFilePath": "/path/to/keyfile.key",
        "serverSSLCertFilePath": "/path/to/certfile.crt",
        "serverSSLCaCertFilePath": "/path/to/certauthorityfile.ca"
    }
```

#### Launch API server

    node src/eos-name-server.js

### BTCPay Client Pairing (Pair This API server w/ BTCPay Server)

Note:

* The pairing step is only needed once per client (e.g. your instance of this eos-name-api).
* The token needs to be stored for usage in the future (handled by server in process below - stored in `<CONFIG.merchantPairingDataFullPath>` relative to project root).
* Pairing codes will expire after 24 hours. However, once a token is approved or claimed, the expiration is cleared.

:warning: This process has a time-out, so make sure you have opened up your `serverConfig.js` so that you can navigate to the appropriate URLs within the timeframe alloted, AND that your API Server is up & running, with SSL certs appropriately applied to both API server and BTCPay Server (otherwise BTCPay server will reject it).

1. Login to your BTCPay Server Admin UI
1. Navigate to STORES :arrow_right: (Selected Store (Create if Necessary))
1. Under the "General Settings":"Profile" View, COPY the value listed in the non-editable "Id" Field. This is your "Store ID"
1. Paste the Store ID in the `serverConfig.json` file in the `btcpayStoreId` field.
1. Navigate to STORES :arrow_right: (Selected Store) :arrow_right: Settings :arrow_right: Access Tokens :arrow_right: Create New Token
1. Give your API server a meaningful label: e.g. "my-eos-name-server-api"
1. LEAVE PUBLIC KEY BLANK, Make sure the "Facade" option is set to "merchant"
1. Click "Request Pairing"
1. Review Settings (Label, Facade, SIN), confirm "Pair to" STORE and click "Approve" - 
    * :warning::boom: YOU NOW HAVE ~24 HOURS TO COMPLETE THE NEXT STEPS, or you must recreate a pairing key, and try again.
1. Copy the "Server initiated pairing code:" at top (e.g. `gvdiRnK`)
1. Using [PostMan](https://www.getpostman.com/tools), (or some such other tool), send a GET request to : `https://my-eos-name-api-server.com/api/v1/generateAndSavePrivateKey` - this will generate and save a private key indentity for your API server. (Highly recommend you run the `dev-watch-eos` command below so you can see output). You should get a response like:
    ```
    {
        "message": "Private key saved to server.",
        "PK": "5d8114bd710163f3703561df34274a29c15cd5ee4301bba8907cdfe2a75c2a60"
    }
    ```
1. EDIT your `serverConfig.js` and paste your pairing code (from above step) into "`oneTimePairingCode`" property - make sure your API server is restarted after this action (again - `dev-watch-eos` command helps here)
1. Again, using [PostMan](https://www.getpostman.com/tools), (or some such other tool), send a GET request to : `https://my-eos-name-api-server.com/api/v1/pairClientWithServer`.  You should get a response like:
    ```
       {
            "message": "Merchant code saved to server.",
            "merchantCode": "CoycgtnCVqjLWvSiZT7EfBmnbjY3yu9fDAPPyJ5zsWsm"
        }
    ```
    * If you receive a 404 message, or `404 - {"error":"The specified pairingCode is not found"}` error, go back to the "Create New Token" step and try again.
1. You should now be able to navigate to your BTCPay Server Admin UI :arrow_right: STORES :arrow_right: (Selected Store)

#### Launch dev-server with live outputs & restarts using node-mon
:warning: Requires [npx](https://www.npmjs.com/package/npx) & [nodemon](https://www.npmjs.com/package/nodemon) global installs (with nvm on Linux machines)

This mode is helpful because there are outputs in the startup scripts that will clue you in to the next steps if you're missing anything (like configs or key files).

    sudo npm run dev-watch-eos

#### Launch server using `forever-service`
:warning: It is highly recommended that you install npm & node using [nvm](https://github.com/creationix/nvm) so that you don't run into EACCESS or permission/sudo issues when using [forever](https://www.npmjs.com/package/forever) & [forever-service](https://www.npmjs.com/package/forever-service)
:warning: :boom: If you have not installed node using nvm, and you have installed global services on Ubuntu machines, you're honestly better off starting from scratch and going back to installing everything with nvm & reinstalling all of your global npm packages after you've got nvm up & running with your preferred version of node.

    sudo forever-service install eos-name-api -r [username] --script ./src/eos-name-server.js --start

#### Restart, stop, delete service (once installed w/ forever-service)

    sudo service eos-name-api restart
    sudo service eos-name-api stop
    sudo forever-service delete eos-name-api

