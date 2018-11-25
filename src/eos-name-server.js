
const fs = require('fs')
const https = require('https')
const btcpay = require('btcpay')
const bitauth = require('bitauth')
const express = require("express");
const bodyParser = require('body-parser')



// GET /api/v1/getSupportedCurrencies
// response = 
// {
//     "BTC": true,
//     "LTC": true,
//     "DASH": true
// }
// ---------------------------------


// response =
// {
//     "paymentAddress": "1z098faoi3rjoawiejfiuawefilawhefj",
//     "expireTime": 1102345678 // Epoch time in seconds
//     "amount": "0.000123"
// }

// errors
// ErrorInvalidCurrencyCode, ErrorInvalidPublicKey

// ie.
// response = {
//   "errorCode": "ErrorInvalidCurrencyCode"
// }

const CONFIG = {
  btcpayServerHostName : "btcpay.cryptosystemsadvisor.com",
  apiPublicDisplayName : "Edge EOS Name Registration and Payment restful API",
  apiVersionPrefix: "/api/v1",
  clientPrivateKeyFullPath : './config/btcpay_client_private.key',
  merchantPairingDataFullPath : './config/btcpay_client_merchant_paring.data',
  btcpayStoreId: '3FhSZKuG8jcFbb4X4LtA3hKry3zbZeesHEchGsJ6xueK',
  oneTimePairingCode: 'xaWTkvT', //get this On BTCPay Server > Stores > Settings > Access Tokens > Create a new token, (leave PublicKey blank) > Request pairing
  supportedCurrencies : { //these will have to manually updated based on btcpay server config for now.
        "tBTC": true,
        "BTC" : false,
        "LTC": false,
        "DASH": false,
        "ETH" : false
    }
}

const ENV = {
  clientPrivateKey : null,
  merchantData: null
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
  
  fs.readFile(CONFIG.clientPrivateKeyFullPath, 'hex', (err,data)=> {
    // console.log("Client private key: ", new Uint8Array(Buffer.from(data)).join('') )
    console.log("Client private key: ", data )

    ENV.clientPrivateKey = data
    if ( ENV.clientPrivateKey === null || ENV.clientPrivateKey === undefined ) {
      console.log("WARNING: CLIENT PRIVATE KEY NOT DETECTED. REQUIRED FOR COMMUNICATION WITH BTCPAY SERVER");
    }


  });
  console.log("READING Client private key...")
  
  fs.readFile(CONFIG.merchantPairingDataFullPath, 'utf8', (err,data)=> {
    if ( data === null || data === undefined ) {
      console.log("WARNING: MERCHANT CODE NOT DETECTED. REQUIRED FOR COMMUNICATION WITH BTCPAY SERVER.");
    } else {
      ENV.merchantData = JSON.parse(data)
      console.log( "MERCHANT DATA: " , ENV.merchantData);
    }


  })
  console.log("READING Client merchant code...")
} catch (e) {

  ENV.clientPrivateKey = null;
}



const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

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
  res.status(200).send({ message: `Welcome to ${CONFIG.apiPublicDisplayName}` })
})

app.get(CONFIG.apiVersionPrefix + "/generateAndSavePrivateKey", function (req, res) {
  // https://github.com/btcpayserver/node-btcpay
  try {
    const keypair = btcpay.crypto.generate_keypair()
    const writeCallback = (err, data) => {
      if (err) {
        console.log("Error in generating and saving private key.", err)
        if (err.code && err.code == 'EEXIST'){
          res.status(500).send({
            message: "Error in generating and saving private key.", 
            err: err, 
            pk: ENV.clientPrivateKey
          })
        }

        
      } else {
        console.log("PRIVATE KEY:" + keypair.priv);
        ENV.clientPrivateKey = keypair.priv
        res.status(200).send({message: "Private key saved to server.", PK: keypair.priv})
      }
    }
    fs.writeFile(CONFIG.clientPrivateKeyFullPath , keypair.priv, {encoding: 'hex',flag:'wx'}, writeCallback);
  } catch (e) {
    console.log("Error in generating and saving private key.", e)
    res.status(500).send({message: "Error in generating and saving private key."})
  }
})

app.get(CONFIG.apiVersionPrefix + "/pairClientWithServer", function (req, res) {
  //BASED on https://support.bitpay.com/hc/en-us/articles/115003001183-How-do-I-pair-my-client-and-create-a-token-
  //the received code needs to be plugged in to the btcpay server admin console to complete the pairing operation
  //to manually approve a pairing code (only needed once per client) for btcpay server visit: https://<your.btcpay.server.instance>/api-access-request?pairingCode=<your pairing code>
  //also see : https://github.com/btcpayserver/node-btcpay#Pairing
  
  const writeCallback = (err, data) => {
    if (err) {
      console.log("Error in pairing and saving merchant code.", err)
      if (err.code && err.code == 'EEXIST'){
        res.status(500).send({
          message: "Error in pairing and saving merchant code.", 
          err: err, 
          merchant: ENV.merchantData
        })
      }
    } else {
      console.log("Merchant code saved to server.");
    }
  }
  
  
  const client = getBtcPayClient()
  
  client
    .pair_client(CONFIG.oneTimePairingCode) //get this On BTCPay Server > Stores > Settings > Access Tokens > Create a new token, (leave PublicKey blank) > Request pairing
    .then((pairResponse) => {
      if (pairResponse.merchant) {
        fs.writeFile(CONFIG.merchantPairingDataFullPath , new Buffer.from(JSON.stringify(pairResponse)), {encoding: 'hex',flag:'wx'}, writeCallback);
        console.log("MERCHANT CODE:" + pairResponse.merchant);
        ENV.merchantData = pairResponse.merchant
        res.status(200).send({
          message: "Merchant code saved to server.",
          merchantCode: pairResponse.merchant
        })
        
      } else {
        res.status(500).send({message : "Error in btc pairing request"});        
      }
    })
})

app.get(CONFIG.apiVersionPrefix + "/rates/:baseCurrency?/:currency?", function (req, res) {
  const baseCurrency = req.params.baseCurrency || 'BTC'
  const currency = req.params.currency || 'USD'
  const client = getBtcPayClient()
  
  
  client.get_rates(`${baseCurrency}_${currency}`, CONFIG.btcpayStoreId)
  .then((rates) => {
    console.log(rates)
    res.status(200).send({message: "Rates response", rates: rates})
  })
  .catch((err) => {
    console.log(err)
    res.status(500).send({message: "Error in rates response", err: err})
  })
})


app.get(CONFIG.apiVersionPrefix + "/getSupportedCurrencies", function (req, res) {
  res.status(200).send(CONFIG.supportedCurrencies)
  // const client = getBtcPayClient()
  // const options = {
  //   port: 443,
  //   hostname: CONFIG.btcpayServerHostName,
  //   method: 'GET',
  //   path: '/currencies',
  //   headers : Object.assign( client.options.headers, 
  //     client._create_signed_headers(), {
  //     'Content-Type': 'application/json',
  //     'Content-Length': postData.length,
  //     'Cache-Control' : 'no-cache'
  //   })
  // }

  // client.currencies()
  //   .then( (currenciesResponse)=> {
  //     res.status(200).send({
  //       message: "Supported currencies retrieved",
  //       currencies: currenciesResponse
  //     })
  //   })
  //   .catch((err) => {
  //     console.log(err)
  //     res.status(500).send({message: "Error in get currencies response", err: err})
  //   })

  // const signedRequest = client._signed_get_request('/currencies',{},ENV.merchantData.merchant)
  // signedRequest
  //   .then( (result) => {
  //     console.log("result: " ,result);
  //     res.status(200).send({message: 'Currency results', currencies: result});
  //   })
  //   .catch( (err) => {
  //     console.log("err: " ,err);
  //     res.status(500).send({message: 'Currency failed', err: err});
  //   })

})

app.post(CONFIG.apiVersionPrefix + "/activateAccount", function (req, res) {
  //validate body
  const body = req.body
  const errors = []
  //expectedParams
  const bodyParams =  ['currencyCode','ownerPublicKey','activePublicKey']
  const validations = [
    () => {
      //body has necessary parameters
      if(typeof(body) !== 'undefined' && typeof(body) === 'object' && body) {
        bodyParams.forEach( (param) => {
          // console.log(`Validating: ${param}...`)
          if (body.hasOwnProperty(param) && typeof body[param] !== 'undefined' && body[param] && body[param].length > 0 && typeof(body[param]) === 'string') {
            
            switch (param) {
              case 'currencyCode':
              // console.log (`currency code requested : ${body[param]}` )
                 if (isSupportedCurrency(body[param]) === false ) {
                   errors.push(
                     getErrorObject(
                       `CurrencyNotSupported`,
                       `This currency '${body[param]}' by this API is not supported at this time.`,
                       {supportedCurrencies : CONFIG.supportedCurrencies}
                     )
                   )
                 }
                break;
            }

          } else {
            errors.push(
              getErrorObject(
                `Invalid_${param}`,
                `${param} is NOT defined as a string in the incoming body.`
              )
            )
          }
        })
      } else {
        errors.push(
          getErrorObject(
            `Invalid_POST_Body`,
            `No parameters were detected in the incoming body.`
          )
        )
      }
    }
  ]

  validations.forEach( (valFn,i) => {
    console.log(`validation ${i}`)
    valFn()
  })

  if (errors.length > 0) {
    res.status(500).send(errors)
  } else {
    //createInvoice for payment & setup watcher
    const client = getBtcPayClient()
    client.create_invoice({price: 20, currency: 'USD'})
      .then((invoice) => {
        console.log("invoice: " , invoice)
        res.status(200).send(invoice)
        // res.status(200).send(
        //   {
        //       "paymentAddress": "1z098faoi3rjoawiejfiuawefilawhefj",
        //       "expireTime": 1102345678, // Epoch time in seconds
        //       "amount": "0.000123"
        //   }
        // )
      })
      .catch(
        (err) => {
          console.log('Error creating invoice:' , err)
          res.status(200).send(err)
        })

    //once invoice is paid (on notification? Will btcpay notify URL)- send EOS payment command

    //eos.createAccountPackage('ownerPubKey', 'activePubKey', 'accountName', bytes, stake_net_quantity, stake_cpu_quantity, transfer)

    
  }

// POST /api/v1/activateAccount
// body = 
// {
//     "currencyCode": "BTC",
//     "ownerPublicKey": "aofijf2039faoiruaowefj",
//     "activePublicKey": "98f23hriualhliauwheifluhaef"
// }

})

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

function getBtcPayClient() {
  const keypair = btcpay.crypto.load_keypair(new Buffer.from(ENV.clientPrivateKey, 'utf8'))
  const client = new btcpay.BTCPayClient("https://"+CONFIG.btcpayServerHostName, keypair, ENV.merchantData ? ENV.merchantData : null)

  return client;
}

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
    console.log(`problem with request: ${e.message}`)
  })
  
  // write data to request body
  req.write(postData)
  console.log("REQUEST OBJECT HEADERS: " , req.getHeaders())

  req.end()

  return req
}

function getErrorObject(errorCode, message, data) {
  const error = {};

  [message, errorCode, data].map( (arg) => {
    arg && arg === errorCode ? error.errorCode = arg : null
    arg && arg === message ? error.message = arg : null
    arg && arg === data ? error.data = arg : null
  })

  return error
}

function isSupportedCurrency(currencyCode) {
  console.log(`isSupportedCurrency() ${currencyCode}`, currencyCode, typeof(currencyCode), CONFIG.supportedCurrencies.hasOwnProperty(currencyCode) )
  let _returnVal = false;
  
  _returnVal = currencyCode 
  && typeof(currencyCode) === 'string' 
  && CONFIG.supportedCurrencies.hasOwnProperty(currencyCode) 
  && CONFIG.supportedCurrencies[currencyCode] ? true : false
  
  console.log(`isSupportedCurrency() : ${_returnVal}`)
  return _returnVal;
}
