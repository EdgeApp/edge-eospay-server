
const fs = require('fs')
const http = require('http')
const https = require('https')
const btcpay = require('btcpay')
const express = require('express')
const bodyParser = require('body-parser')
const nano = require('nano')

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
  btcpayServerHostName: 'btcpay.cryptosystemsadvisor.com',
  apiPublicDisplayName: 'Edge EOS Name Registration and Payment restful API',
  apiVersionPrefix: '/api/v1',
  clientPrivateKeyFullPath: './config/btcpay_client_private.key',
  merchantPairingDataFullPath: './config/btcpay_client_merchant_paring.data',
  btcpayStoreId: '3FhSZKuG8jcFbb4X4LtA3hKry3zbZeesHEchGsJ6xueK',
  oneTimePairingCode: 'xaWTkvT', // get this On BTCPay Server > Stores > Settings > Access Tokens > Create a new token, (leave PublicKey blank) > Request pairing
  supportedCurrencies:
    {
      // these will have to manually updated based on btcpay server config for now.
      'BTC': true,
      'LTC': false,
      'DASH': false,
      'ETH': false
    },
  // invoiceNotificationEmailAddress: 'chuck@screenscholar.com',
  invoiceNotificationURL: 'https://eos-name-api.cryptoambassador.work/api/v1/invoiceNotificationEvent/',
  dbFullpath: 'http://admin:admin@localhost:5984',
  btcPayInvoicePropsToSave: [
    'url', 'status', 'btcPrice', 'btcDue', 'cryptoInfo', 'price', 'currency', 'invoiceTime', 'expirationTime',
    'currentTime', 'lowFeeDetected', 'btcPaid', 'rate', 'exceptionStatus', 'refundAddressRequestPending', 
    'token', 'paymentSubtotals', 'paymentTotals', 'amountPaid', 'minerFees', 'exchangeRates', 'addresses'
  ]
}

const ENV = {
  clientPrivateKey: null,
  merchantData: null,
  port: process.env.PORT || 3000,
  serverSSLKeyFilePath: '/etc/letsencrypt/live/eos-name-api.cryptoambassador.work/privkey.pem',
  serverSSLCertFilePath: '/etc/letsencrypt/live/eos-name-api.cryptoambassador.work/fullchain.pem'
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
  fs.readFile(CONFIG.clientPrivateKeyFullPath, 'hex', (err, data) => {
    // 634("Client private key: ", new Uint8Array(Buffer.from(data)).join('') )
    console.log('Client private key: ', data)
    if (err) {
      getErrorObject('FailureReadingAPIClientPrivateKey','Error reading API private key for identifying to BTCPay Server. Please generate with a call to generateAndSavePrivateKey path.',err)
    }

    ENV.clientPrivateKey = data
    if (ENV.clientPrivateKey === null || ENV.clientPrivateKey === undefined) {
      console.log('WARNING: CLIENT PRIVATE KEY NOT DETECTED. REQUIRED FOR COMMUNICATION WITH BTCPAY SERVER')
    }
  })
  console.log('READING Client private key...')

  fs.readFile(CONFIG.merchantPairingDataFullPath, 'utf8', (err, data) => {
    if (err) {
      getErrorObject('FailureReadingAPIClientMerchantCode','Error reading API merchant code for identifying to BTCPay Server. Please get this On BTCPay Server > Stores > Settings > Access Tokens > Create a new token, (leave PublicKey blank) > Request pairing, and enter code into API CONFIG.oneTimePairingCode.',err)
    }

    if (data === null || data === undefined) {
      console.log('WARNING: MERCHANT CODE NOT DETECTED. REQUIRED FOR COMMUNICATION WITH BTCPAY SERVER.')
    } else {
      ENV.merchantData = JSON.parse(data)
      console.log('MERCHANT DATA: ', ENV.merchantData)
    }
  })
  console.log('READING Client merchant code...')
} catch (e) {
  ENV.clientPrivateKey = null
}
/***
 *                                    _____
 *      ____ _____    ____   ____   _/ ____\___________
 *     /    \\__  \  /    \ /  _ \  \   __\/  _ \_  __ \
 *    |   |  \/ __ \|   |  (  <_> )  |  | (  <_> )  | \/
 *    |___|  (____  /___|  /\____/   |__|  \____/|__|
 *         \/     \/     \/
 *                               .__         .______.
 *      ____  ____  __ __   ____ |  |__    __| _/\_ |__
 *    _/ ___\/  _ \|  |  \_/ ___\|  |  \  / __ |  | __ \
 *    \  \__(  <_> )  |  /\  \___|   Y  \/ /_/ |  | \_\ \
 *     \___  >____/|____/  \___  >___|  /\____ |  |___  /
 *         \/                  \/     \/      \/      \/
 */

const nanoDb = nano(CONFIG.dbFullpath)
const invoiceTxDb = nanoDb.db.use('invoice_tx')

try {
  console.log('DB check & init')

  // nanoDb.db.destroy('invoice_tx',(err, body) => {
  //   if (err) {
  //     console.log( '***ERROR destroying db: invoice_tx', err)
  //   } else{
  //     console.log('database invoice_tx destroyed!', body)
  //   }
  // })

  nanoDb.db.get('invoice_tx', (err, dbResponse) => {
    console.log('err: ', err)

    switch (true) {
      case err && err.error === 'not_found':
        throw (new Error('invoice_tx database does not exist.'))
      case err && err.error === 'nodedown':
        throw (new Error('Database appears to be down.'))
      default:
        console.log('dbResponse: ', dbResponse)
        break
    }
  })
} catch (e) {
  console.log('ERROR in DB check & init', e)
}
// =============================================================================

const app = express()
const credentials = {
  cert: fs.readFileSync(ENV.serverSSLCertFilePath),
  key: fs.readFileSync(ENV.serverSSLKeyFilePath)
}
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Starting both http & https servers
const httpServer = http.createServer(app)
const httpsServer = https.createServer(credentials, app)

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

app.get(CONFIG.apiVersionPrefix + '/', function (req, res) {
  res.status(200).send({ message: `Welcome to ${CONFIG.apiPublicDisplayName}` })
})

app.get(CONFIG.apiVersionPrefix + '/generateAndSavePrivateKey', function (req, res) {
  // https://github.com/btcpayserver/node-btcpay
  try {
    const keypair = btcpay.crypto.generate_keypair()
    const writeCallback = (err, data) => {
      if (err) {
        console.log('Error in generating and saving private key.', err)
        if (err.code && err.code === 'EEXIST') {
          res.status(500).send({
            message: 'Error in generating and saving private key.',
            err: err,
            pk: ENV.clientPrivateKey
          })
        }
      } else {
        console.log('PRIVATE KEY:' + keypair.priv)
        ENV.clientPrivateKey = keypair.priv
        res.status(200).send({message: 'Private key saved to server.', PK: keypair.priv})
      }
    }
    fs.writeFile(CONFIG.clientPrivateKeyFullPath, keypair.priv, {encoding: 'hex', flag: 'wx'}, writeCallback)
  } catch (e) {
    console.log('Error in generating and saving private key.', e)
    res.status(500).send({message: 'Error in generating and saving private key.'})
  }
})

app.get(CONFIG.apiVersionPrefix + '/pairClientWithServer', function (req, res) {
  // BASED on https://support.bitpay.com/hc/en-us/articles/115003001183-How-do-I-pair-my-client-and-create-a-token-
  // the received code needs to be plugged in to the btcpay server admin console to complete the pairing operation
  // to manually approve a pairing code (only needed once per client) for btcpay server visit: https://<your.btcpay.server.instance>/api-access-request?pairingCode=<your pairing code>
  // also see : https://github.com/btcpayserver/node-btcpay#Pairing

  const writeCallback = (err, data) => {
    if (err) {
      console.log('Error in pairing and saving merchant code.', err)
      if (err.code && err.code === 'EEXIST') {
        res.status(500).send({
          message: 'Error in pairing and saving merchant code.',
          err: err,
          merchant: ENV.merchantData
        })
      }
    } else {
      console.log('Merchant code saved to server.')
    }
  }

  const client = getBtcPayClient()

  client
    .pair_client(CONFIG.oneTimePairingCode) // get this On BTCPay Server > Stores > Settings > Access Tokens > Create a new token, (leave PublicKey blank) > Request pairing
    .then((pairResponse) => {
      if (pairResponse.merchant) {
        const pairResponseBuffer = Buffer.from(JSON.stringify(pairResponse))

        fs.writeFile(CONFIG.merchantPairingDataFullPath, pairResponseBuffer, {encoding: 'hex', flag: 'wx'}, writeCallback)
        console.log('MERCHANT CODE:' + pairResponse.merchant)
        ENV.merchantData = pairResponse.merchant
        res.status(200).send({
          message: 'Merchant code saved to server.',
          merchantCode: pairResponse.merchant
        })
      } else {
        res.status(500).send({message: 'Error in btc pairing request'})
      }
    })
})

app.get(CONFIG.apiVersionPrefix + '/rates/:baseCurrency?/:currency?', function (req, res) {
  const baseCurrency = req.params.baseCurrency || 'BTC'
  const currency = req.params.currency || 'USD'
  const client = getBtcPayClient()

  client.get_rates(`${baseCurrency}_${currency}`, CONFIG.btcpayStoreId)
    .then((rates) => {
      console.log(rates)
      res.status(200).send({message: 'Rates response', rates: rates})
    })
    .catch((err) => {
      console.log(err)
      res.status(500).send({message: 'Error in rates response', err: err})
    })
})

app.get(CONFIG.apiVersionPrefix + '/getSupportedCurrencies', function (req, res) {
  res.status(200).send(CONFIG.supportedCurrencies)
})

app.post(CONFIG.apiVersionPrefix + '/activateAccount', function (req, res) {
  // validate body
  const body = req.body
  const errors = []
  // expectedParams
  const bodyParams = ['currencyCode', 'ownerPublicKey', 'activePublicKey']

  let requestedPaymentCurrency = ''
  let invoiceTx = {}

  const validations = [
    () => {
      // body has necessary parameters
      if (typeof (body) !== 'undefined' && typeof (body) === 'object' && body) {
        bodyParams.forEach((param) => {
          // console.log(`Validating: ${param}...`)
          if (body.hasOwnProperty(param) && typeof body[param] !== 'undefined' && body[param] && body[param].length > 0 && typeof (body[param]) === 'string') {
            switch (param) {
              case 'currencyCode':
              // console.log (`currency code requested : ${body[param]}` )
                if (isSupportedCurrency(body[param]) === false) {
                  errors.push(
                    getErrorObject(
                      `CurrencyNotSupported`,
                      `This currency '${body[param]}' by this API is not supported at this time.`,
                      {supportedCurrencies: CONFIG.supportedCurrencies}
                    )
                  )
                } else {
                  requestedPaymentCurrency = body[param]
                }
                break
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

  validations.forEach((valFn, i) => {
    console.log(`validation ${i}`)
    valFn()
  })

  if (errors.length > 0) {
    res.status(500).send(errors)
  } else {
    // createInvoice for payment & setup watcher
    const client = getBtcPayClient()
    client.create_invoice({
      price: 0.01,
      currency: 'USD',
      notificationEmail: CONFIG.invoiceNotificationEmailAddress || null,
      notificationURL: CONFIG.invoiceNotificationURL || null,
      extendedNotifications: true,
      physical: false
      // buyer : {
      //   name: {
      //     ownerPublicKey : body.ownerPublicKey,
      //     activePublicKey : body.activePublicKey
      //   }
      // }

    })
      .then((invoice) => {
        console.log('invoice: ', invoice)

        invoiceTx = formatCleanupInvoiceData(invoice)

        invoiceTx._id = invoice.id
        invoiceTx.ownerPublicKey = body.ownerPublicKey
        invoiceTx.activePublicKey = body.activePublicKey
        invoiceTx.eventStatusHistory = [{
          time: invoiceTx.currentTime,
          status: invoiceTx.status,
          event: null
        }]

        // invoiceTx._rev = _rev
        invoiceTxDb.insert(invoiceTx, (err, insertResult) => {
          if (err) {
            console.log()
            res.status(500).send({message: 'Error saving transaction', error: err})
          } else {
            res.status(200).send(
              {
                currencyCode: requestedPaymentCurrency,
                paymentAddress: invoiceTx.addresses && invoiceTx.addresses[requestedPaymentCurrency],
                expireTime: invoiceTx.expirationTime,
                amount: invoiceTx.cryptoInfo[0].totalDue,
                rate: invoiceTx.cryptoInfo[0].rate
              })
          }
        })

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
          console.log('Error creating invoice:', err)
          res.status(500).send({message: 'error creating invoice', error: err})
        })

    // once invoice is paid (on notification? Will btcpay notify URL)- send EOS payment command

    // eos.createAccountPackage('ownerPubKey', 'activePubKey', 'accountName', bytes, stake_net_quantity, stake_cpu_quantity, transfer)
  }

// POST /api/v1/activateAccount
// body =
// {
//     "currencyCode": "BTC",
//     "ownerPublicKey": "aofijf2039faoiruaowefj",
//     "activePublicKey": "98f23hriualhliauwheifluhaef"
// }
})

app.post(CONFIG.apiVersionPrefix + '/invoiceNotificationEvent', function (req, res) {
  console.log('/invoiceNotificationEvent:body', req.body)

  const invoiceId = typeof (req.body) === 'object' && req.body.data && req.body.data.id
  const btcpayInvoiceEventCode = typeof (req.body) === 'object' && req.body.event && req.body.event.code
  const btcpayInvoiceEventName = typeof (req.body) === 'object' && req.body.event && req.body.event.name
  const invoiceEventData = formatCleanupInvoiceData(typeof (req.body) === 'object' && (req.body.data || req.body))
  let invoiceTx = {}
  let _doUpdate = false
  const responseObject = {
    errors: [],
    warnings: [],
    messages: []
  }
  const btcPayNotificationResponse = {
    ok: () => { 
      if (_doUpdate === false) {
        res.status(200).send({message: 'ok'}) 
      } else {
        responseObject.messages.push({message: 'ok'})
      }
    },
    error: (errorObj = getErrorObject('NotificationEventError', 'An error while processing BTCPay notification event')) => {
      console.log(errorObj.message, errorObj)
      if (_doUpdate === false) {
        res.status(500).send(errorObj)
      } else {
        responseObject.errors.push(errorObj)
      }
    },
    warning: (warningObject = getErrorObject('NotificationEventWarning', 'Something unhappy occurred while processing BTCPay notification event')) => {
      console.log(warningObject.message, warningObject)

      if (_doUpdate === false) {
        res.status(200).send(warningObject)
      } else {
        responseObject.warnings.push(warningObject)
      }

    }
  }
  const updateInvoiceData = (invoiceTx) => {
    invoiceTxDb.insert(invoiceTx, (err, insertResult) => {
      if (err) {
        console.log(getErrorObject('ErrorSavingInvoice', 'An error occurred while saving invoice.', err))
        // res.status(500).send({message: 'Error saving transaction', error: err})
      } else {
        console.log('Successsfully saved invoice from notification update.', responseObject)
        responseObject.messages.push(invoiceTx)
        res.status(200).send(responseObject)
      }
    })
  }

  console.log('invoiceEventData: ', invoiceEventData)

  invoiceTxDb.get(invoiceId, (err, invoiceData) => {
    if (err) {
      console.log(getErrorObject('InvoiceTxDbError', 'Failure retrieving invoice from database on btcpay notification.', err))
    } else {
      // invoiceTx = Object.assign(invoiceData)

      for (let property in invoiceData) {
        // optional check for properties from prototype chain
        if (invoiceEventData.hasOwnProperty(property) || invoiceData.hasOwnProperty(property)) {
          invoiceTx[property] = invoiceEventData[property] || invoiceData[property] || null
          // no a property from prototype chain
        } else {
          // property from protytpe chain
        }
      }

      if (invoiceData.eventStatusHistory && Array.isArray(invoiceData.eventStatusHistory)) {
        invoiceTx.eventStatusHistory.push({
          time: invoiceEventData.currentTime,
          status: invoiceEventData.status,
          event: btcpayInvoiceEventName
        })
      }

      switch (btcpayInvoiceEventCode) {
        case 1001://invoice_created
        case 1002: //invoice_receivedPayment
        case 1003: //invoice_paidInFull
        case 1004: //invoice_expired
        case 1006: //invoice_completed
        case 1010: //invoice_expiredPartial
          // do nothing special
          _doUpdate = true
          btcPayNotificationResponse.ok()
          break

        case 1005: //invoice_confirmed
          // invoke eos broadcast call
          _doUpdate = true
          btcPayNotificationResponse.ok()
          break
        case 1007: //invoice_refunded
        case 1016: //invoice_refundComplete
          // TODO: confirm setup disallows refunds
          _doUpdate = true
          btcPayNotificationResponse.ok()
          break
        case 1008: //invoice_markedInvalid
        case 1009: //invoice_paidAfterExpiration
          // TODO: confirm how to handle?
          btcPayNotificationResponse.warning()
          break

        case 1011: //invoice_blockedByTierLimit
        case 1012: //invoice_manuallyNotified
        case 1013: //invoice_failedToConfirm
        case 1014: //invoice_latePayment
        case 1015: //invoice_adjustmentComplete
        // log error / notification
          console.log('Unhandled Invoice Event received', req.body)
          _doUpdate = true
          btcPayNotificationResponse.warning(
            getErrorObject('InvoiceStatusIrregularity', 'Something unhappy occurred while processing BTCPay notification event.', req.body)
          )
          break

        case 2001: //payoutRequest_funded
        case 2002: //payoutRequest_completed
        case 2003: //payoutRequest_cancelled
          // Payouts are batches of bitcoin payments to employees, customers, partners, etc.
          // TODO: confirm payoutRequests cannot be invoked or are blocked by configuration
          console.log('Unhandled Payout Request Event received', req.body)
          btcPayNotificationResponse.warning(
            getErrorObject('InvoicePayoutRequestWarning', 'A BTCPay notification event for payout has been received, and should probably not have been.', req.body)
          )
          break

        case 3001: //org_completedSetup
          // TODO: confirm event conditions & handle if necessary
          btcPayNotificationResponse.warning(
            getErrorObject('OrgCompletedSetupWarning', 'A BTCPay notification event for org setup complete has been received, and should probably not have been.', req.body)
          )

          break
        default:
          btcPayNotificationResponse.warning(
            getErrorObject('UnhandledNotificationEventWarning', 'A BTCPay notification event for an unknown/unhandled Event has been received, and should probably not have been.', req.body)
          )
          break
      }

      if (_doUpdate) {
        updateInvoiceData(invoiceTx)
      }
    }
  })
})

httpServer.listen(ENV.port, () => {
  console.log(`HTTP Server running on port ${ENV.port}`)
})

httpsServer.listen(443, () => {
  console.log('HTTPS Server running on port 443')
})

/***
 *      ___ ______________.____   _______________________________  _________
 *     /   |   \_   _____/|    |  \______   \_   _____/\______   \/   _____/
 *    /    ~    \    __)_ |    |   |     ___/|    __)_  |       _/\_____  \
 *    \    Y    /        \|    |___|    |    |        \ |    |   \/        \
 *     \___|_  /_______  /|_______ \____|   /_______  / |____|_  /_______  /
 *           \/        \/         \/                \/         \/        \/
 */

function getBtcPayClient () {
  const keypair = btcpay.crypto.load_keypair(Buffer.from(ENV.clientPrivateKey, 'utf8'))
  const client = new btcpay.BTCPayClient('https://' + CONFIG.btcpayServerHostName, keypair, ENV.merchantData ? ENV.merchantData : null)

  return client
}

function formatCleanupInvoiceData (invoiceTxData) {
  const _returnObj = {}

  CONFIG.btcPayInvoicePropsToSave.forEach((prop) => {
    switch (true) {
      case invoiceTxData[prop] !== null && typeof (invoiceTxData[prop]) !== 'undefined':
        switch (prop) {
          case 'invoiceTime':
          case 'expirationTime':
          case 'currentTime':
            _returnObj[prop] = Math.trunc(Number(invoiceTxData[prop]) / 1000)
            break
          default:
            _returnObj[prop] = invoiceTxData[prop]
            break
        }
        break
      default:
        console.log(`${prop} not avialable on invoice object. Check configs for properties to save`)
        break
    }
  })

  console.log('_formatCleanupInvoiceData()', _returnObj)

  return _returnObj
}

function getErrorObject (errorCode, message, data) {
  const error = {};
  for (let arg in arguments) {
    const value = arguments[arg]
    switch (true) {
      case value && value === errorCode:
      error.errorCode = value
      break
      case value && value === message:
      error.message = value
      break
      case value && value === data:
      error.data = value
      break
      default:
      //do nothing
      break
    }
  }
  
  return error
}

function isSupportedCurrency (currencyCode) {
  console.log(`isSupportedCurrency() ${currencyCode}`, currencyCode, typeof (currencyCode), CONFIG.supportedCurrencies.hasOwnProperty(currencyCode))
  let _returnVal = false

  _returnVal = !!(currencyCode &&
  typeof (currencyCode) === 'string' &&
  CONFIG.supportedCurrencies.hasOwnProperty(currencyCode) &&
  CONFIG.supportedCurrencies[currencyCode])

  console.log(`isSupportedCurrency() : ${_returnVal}`)
  return _returnVal
}
