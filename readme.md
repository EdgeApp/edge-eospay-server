# Edge <> EOS Name Registration and Activation Server

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
        "btcpayServerHostName": "btcpay135208.lndyn.com", 
```
:boom: Host Name (will need to setup SSL Certificates and be available on the interwebs so that the BTCPay Server can safely communicate with it.
```
        "apiPublicDisplayName": "Edge EOS Name Registration and Payment restful API",
        "apiVersionPrefix": "/api/v1",
        "clientPrivateKeyFullPath": "./config/btcpay_client_private.key",
        "merchantPairingDataFullPath": "./config/btcpay_client_merchant_paring.data",
```
:boom: Thes above full paths are used by the server as read/write destinations with some API key-pairing/generation calls, so be sure that no write issues exist
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
:boom: These values above are all used by the BTCPay Server for connecting clients (this API server) that are authorized to generate invoices, receive updates on confirmations, expirations, etc. Make sure that this list of currencies is in alignmnet with the currencies configured on your BTCPay Server!
``` 
        "dbFullpath": "http://admin:couchDBPassword@localhost:5984",
        "btcPayInvoicePropsToSave": [
            "url", "status", "btcPrice", "btcDue", "cryptoInfo", "price", "currency", "invoiceTime", "expirationTime",
            "currentTime", "lowFeeDetected", "rate", "exceptionStatus", "refundAddressRequestPending", 
            "token", "paymentSubtotals", "paymentTotals", "amountPaid", "minerFees", "addresses"
        ],
        "eosCreatorAccountPrivateKey" : "EOSPrivateKeyAssociatedWithPaying/CreatingAccount",
```
You'll need to create an account on the EOS network that is WELL funded with CPU/NET/RAM to pay for & allocate the creation of other accounts. This is the private key for that creator account. KEEP IT SAFE!
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
[EOSJS](https://github.com/EOSIO/eosjs) configs. [Docs here](https://eosio.github.io/eosjs/)
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
:point_up: This is configuration for the [CoinMarketCap Pro API](https://coinmarketcap.com/api/documentation/v1/) for crypto pricing. 
```
        "serverSSLKeyFilePath": "/path/to/keyfile.key",
        "serverSSLCertFilePath": "/path/to/certfile.crt",
        "serverSSLCaCertFilePath": "/path/to/certauthorityfile.ca"
    }
```


#### Launch API server

    node src/eos-name-server.js

#### Launch server using `forever-service`

    sudo forever-service install eos-name-api -r [username] --script ./src/eos-name-server.js --start

#### Restart, stop, delete service

    sudo service indexInfo restart
    sudo service indexInfo stop
    sudo forever-service delete indexInfo

