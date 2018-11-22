
const fs = require('fs')
const https = require('https')
const btcpay = require('btcpay')
const bitauth = require('bitauth')
const express = require("express");
const bodyParser = require('body-parser')

const CONFIG = {
  btcpayServerHostName : "btcpay.cryptosystemsadvisor.com",
  apiPublicDisplayName : "Edge EOS Name Registration and Payment restful API",
  apiVersionPrefix: "/api/v1",
  clientPrivateKeyFullPath : './config/btcpay_client_private.key'
}

const ENV = {
  clientPrivateKey : null
}

/***
 *      _________________________ _________________________ _____________ 
 *     /   _____/\__    ___/  _  \\______   \__    ___/    |   \______   \
 *     \_____  \   |    | /  /_\  \|       _/ |    |  |    |   /|     ___/
 *     /        \  |    |/    |    \    |   \ |    |  |    |  / |    |    
 *    /_______  /  |____|\____|__  /____|_  / |____|  |______/  |____|    
 *            \/                 \/       \/                              
 *                                                                        
 */

try {
  fs.readFile(CONFIG.clientPrivateKeyFullPath, (err,data)=> {
    console.log("Client private key: ", data);
    ENV.clientPrivateKey = data;
  });
} catch (e) {
  ENV.clientPrivateKey = null;
}

if ( ENV.clientPrivateKey === null || ENV.clientPrivateKey === undefined ) {
  console.log("WARNING: CLIENT PRIVATE KEY NOT DETECTED. REQUIRED FOR COMMUNICATION WITH BTCPAY SERVER");
}

const app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/***
 *    __________ ________   ____ _________________________ _________
 *    \______   \\_____  \ |    |   \__    ___/\_   _____//   _____/
 *     |       _/ /   |   \|    |   / |    |    |    __)_ \_____  \ 
 *     |    |   \/    |    \    |  /  |    |    |        \/        \
 *     |____|_  /\_______  /______/   |____|   /_______  /_______  /
 *            \/         \/                            \/        \/ 
 *                                                                  
 */

// const routes = require("./routes/routes.js");

app.get(CONFIG.apiVersionPrefix + "/", function (req, res) {
  res.status(200).send({ message: `Welcome to ${CONFIG.apiPublicDisplayName}` });
});


app.get(CONFIG.apiVersionPrefix + "/generateAndSavePrivateKey", function (req, res) {
  // https://github.com/btcpayserver/node-btcpay
  try {
    const keypair = btcpay.crypto.generate_keypair()
    fs.writeFile(CONFIG.clientPrivateKeyFullPath ,new Uint8Array(Buffer.from(keypair.priv)),(err, data) => {
      console.log("Error in generating and saving private key.", err, data);  
      res.status(500).send({message: "Error in generating and saving private key."});
    })
    console.log("PRIVATE KEY:" + keypair.priv);
    res.status(200).send(keypair.priv);
  } catch (e) {
    console.log("Error in generating and saving private key.", e);
    res.status(500).send({message: "Error in generating and saving private key."});
  }
})

app.get(CONFIG.apiVersionPrefix + "/getBtcPayServerPairingCode", function (req, res) {
  //BASED on https://support.bitpay.com/hc/en-us/articles/115003001183-How-do-I-pair-my-client-and-create-a-token-
  //the received code needs to be plugged in to the btcpay server admin console to complete the pairing operation
  //to manually approve a pairing code (only needed once per client) for btcpay server visit: https://<your.btcpay.server.instance>/api-access-request?pairingCode=<your pairing code>
  const btcPayPairRequest = pairWithBtcPayServer();
  
  btcPayPairRequest.on('response', (_btcpayres) => {
    _btcpayres.on('data', (chunk) => {
      console.log("btcpayPairRequestResponse RAW: ", chunk)
      const btcpayPairRequestResponse = JSON.parse(chunk)
      console.log("btcpayPairRequestResponse JSON parsed: ", btcpayPairRequestResponse)

      if (btcpayPairRequestResponse.data 
        && btcpayPairRequestResponse.data[0] 
        && btcpayPairRequestResponse.data[0].token) {
        res.status(200).send(btcpayPairRequestResponse.data[0]);
      } else {
        res.status(500).send({message : "Error in btc pairing request"});
      }
    })
  })
})

app.get(CONFIG.apiVersionPrefix + "/getSupportedCurrencies", function (req, res) {
  
});

const server = app.listen(3000, function () {
    console.log("app running on port.", server.address().port);
})

/***
 *      ___ ______________.____   _______________________________  _________
 *     /   |   \_   _____/|    |  \______   \_   _____/\______   \/   _____/
 *    /    ~    \    __)_ |    |   |     ___/|    __)_  |       _/\_____  \ 
 *    \    Y    /        \|    |___|    |    |        \ |    |   \/        \
 *     \___|_  /_______  /|_______ \____|   /_______  / |____|_  /_______  /
 *           \/        \/         \/                \/         \/        \/ 
 */

function pairWithBtcPayServer()  {
  console.log("pairWithBtcPayServer()");
  const sin = bitauth.generateSin()
  // const client = new btcpay.BTCPayClient('https://btcpay.cryptosystemsadvisor.com', keypair)
  const postData = JSON.stringify({
    'id': sin.sin,
    'label' : CONFIG.apiPublicDisplayName,
    'facade': 'merchant'
  })
  
  const options = {
    port: 443,
    hostname: CONFIG.btcpayServerHostName,
    method: 'POST',
    path: '/tokens',
    headers : {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
      'Cache-Control' : 'no-cache'
    }
  }
  
  const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`)
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`)
  
    })
    res.on('end', () => {
      console.log('No more data in response.')
    })
    
  })
  
  req.on('error', (e) => {
    console.log(`problem with request: ${e.message}`);
  });
  
  // write data to request body
  req.write(postData);
  
  console.log("REQUEST OBJECT HEADERS: " , req.getHeaders());
  // console.log("REQUEST OBJECT BODY: " , req.);
  
  req.end();

  return req;
}
