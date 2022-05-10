import { readEosPricesCacheJson } from './eosPrices'
import {
  getLatestEosActivationPriceInSelectedCryptoCurrency
} from './exchangeRates'
import axios from 'axios'
import { isThisTypeNode } from 'typescript'
const fs = require('fs')
const http = require('http')
const cors = require('cors')
const btcpay = require('btcpay')
const express = require('express')
const bodyParser = require('body-parser')
const nano = require('nano')
const eosjs = require('eosjs')
const { bns } = require('biggystring')
const fetch = require('node-fetch')
const { JsonRpc } = require('@eoscafe/hyperion')

const CONFIG = require('../config/serverConfig')

const privKey = fs.readFileSync(CONFIG.clientHexPrivateKeyFullPath, 'utf8')
const keypair = btcpay.crypto.load_keypair(privKey)
const merchantFileData = fs.readFileSync(CONFIG.merchantPairingDataFullPath, 'utf8')
const merchantData = JSON.parse(merchantFileData)
const merchantKey = merchantData.merchant
if (!merchantKey) throw new Error('No merchant key present!')
const btcPayClient = new btcpay.BTCPayClient(`https://${CONFIG.btcpayServerHostName}`, keypair, {
  merchant: merchantKey
})

const { ecc, format } = eosjs.modules

// configure master config objects with specific chain data

const chains = { ...CONFIG.chains }
for (const chain in chains) {
  chains[chain].hyperionRpc = new JsonRpc(CONFIG.chains[chain].hyperionEndpoint, { fetch })
  chains[chain].activationPublicKey = ecc.privateToPublic(
    CONFIG.chains[chain].eosCreatorAccountPrivateKey
  )
  console.log('chains[chain].activationPublicKey: ', chains[chain].activationPublicKey)
  chains[chain].eosJsInstance = eosjs(chains[chain].eosjsConfig)
  console.log('Chain is: ', chain)
  chains[chain].eosJsInstance.getInfo((error, result) => {
    console.log(error, result.chain_id)
  })
}

const ENV = {
  clientPrivateKey: null,
  merchantData: null,
  port: process.env.PORT || 8008
}

let app

/***
 *      _________________________ _________________________ _____________
 *     /   _____/\__    ___/  _  \\______   \__    ___/    |   \______   \
 *     \_____  \   |    | /  /_\  \|       _/ |    |  |    |   /|     ___/
 *     /        \  |    |/    |    \    |   \ |    |  |    |  / |    |
 *    /_______  /  |____|\____|__  /____|_  / |____|  |______/  |____|
 *            \/                 \/       \/
 *
 */

console.log('about to init')
let invoiceTxDb

// ending point

async function init () {
  try {
    fs.readFile(CONFIG.clientHexPrivateKeyFullPath, 'hex', (err, data) => {
      if (err) {
        getErrorObject(
          'FailureReadingAPIClientPrivateKey',
          'Error reading API private key for identifying to BTCPay Server. Please generate with a call to generateAndSavePrivateKey path.',
          err
        )
      }

      ENV.clientPrivateKey = data
      if (ENV.clientPrivateKey === null || ENV.clientPrivateKey === undefined) {
        console.log(
          'WARNING: CLIENT PRIVATE KEY NOT DETECTED. REQUIRED FOR COMMUNICATION WITH BTCPAY SERVER'
        )
      }
    })
    // console.log('READING Client private key...')

    fs.readFile(CONFIG.merchantPairingDataFullPath, 'utf8', (err, data) => {
      if (err) {
        getErrorObject(
          'FailureReadingAPIClientMerchantCode',
          'Error reading API merchant code for identifying to BTCPay Server. Please get this On BTCPay Server > Stores > Settings > Access Tokens > Create a new token, (leave PublicKey blank) > Request pairing, and enter code into API CONFIG.oneTimePairingCode.',
          err
        )
      }

      if (data === null || data === undefined) {
        console.log(
          'WARNING: MERCHANT CODE NOT DETECTED. REQUIRED FOR COMMUNICATION WITH BTCPAY SERVER.'
        )
      } else {
        ENV.merchantData = JSON.parse(data)
        console.log('MERCHANT DATA: ', ENV.merchantData)
      }
    })
    // console.log('READING Client merchant code...')
  } catch (e) {
    ENV.clientPrivateKey = null
  }

  for (const chain in chains) {
    const {  HYPERION_ENDPOINT } = chains[chain]
    let accountName

    const fetchAccount = async () => {
      try {
        console.log('chains[chain].activationPublicKey: ', chains[chain].activationPublicKey)
        const accountNameResults = await axios.post(`${HYPERION_ENDPOINT}/v1/history/get_key_accounts`, {
          public_key: chains[chain].activationPublicKey
        })
        accountName = accountNameResults.data.account_names[0]
        if (!accountName) throw new Error('Unable to find creator account for ' + chain)
        console.log(chain, ' creatorAccountName: ', accountName)
        chains[chain].creatorAccountName = accountName
      } catch (error) {
        // duplicate code
        setTimeout(async () => {
          await fetchAccount()
        }, 5000)
        console.log('get_key_accounts error: ', error)
      }
    }

    await fetchAccount()

    const fetchTokenBalance = async () => {
      try {
        const accountTokensResponse = await axios.get(
          `${HYPERION_ENDPOINT}/v2/state/get_account?account=${accountName}`
        )
        const { core_liquid_balance } = accountTokensResponse.data.account
        console.log('core_liquid_balance: ', core_liquid_balance)
        if (!core_liquid_balance) {
          throw new Error(`No primary tokens in creation account for ${chain}`)
        }

      } catch (error) {
        console.log('get_tokens error: ', error)
        setTimeout(async () => {
          await fetchTokenBalance()
        }, 5000)
      }
    }
  }

  // PRICING
  try {
    // testing pricing
    const eosResult = await getLatestEosActivationPriceInSelectedCryptoCurrency('BTC', 'EOS')
    console.log('[EOS] getLatestEosActivationPriceInSelectedCryptoCurrency.result : ', eosResult)

    const tlosResult = await getLatestEosActivationPriceInSelectedCryptoCurrency('BTC', 'TLOS')
    console.log('[TLOS] getLatestEosActivationPriceInSelectedCryptoCurrency.result : ', tlosResult)

  } catch (err) {
    throw ('Error in PRICING startup calls: ', err)
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

  // console.log('kylan about to use nanoDb')
  const nanoDb = nano(CONFIG.dbFullpath)
  // console.log('nanoDb is: ', nanoDb)
  invoiceTxDb = nanoDb.db.use('invoice_tx')
  if (!invoiceTxDb) {
    console.log('No invoiceTxDB! Please restart!')
    process.exit()
  } else {

  }

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
      console.log('nanoDb.get invoice_tx err: ', err)

      switch (true) {
        case err && err.error === 'not_found':
          throw new Error('invoice_tx database does not exist.')
        case err && err.error === 'nodedown':
          throw new Error('Database appears to be down.')
        default:
          // console.log('dbResponse: ', dbResponse)
          console.log('db has response')
          break
      }
    })
  } catch (e) {
    console.log('ERROR in DB check & init', e)
  }
  // =============================================================================
}

init()

app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())

// Starting both http & https servers
const httpServer = http.createServer(app)

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

app.get(CONFIG.apiVersionPrefix + '/invoiceTxs', async function (req, res) {
  const params = {
    dateStart: '2020-01-01',
    dateEnd: '2020-03-24',
    limit: 50,
    offset: 0
  }
  btcPayClient
    .get_invoices()
    .then(async btcPayInvoices => {
      const body = await invoiceTxDb.list()
      // const results = []
      const resultsObj = {}
      body.rows.forEach(doc => {
        // console.log(doc)
        resultsObj[doc.id] = invoiceTxDb.get(doc.id)
        // results.push(data)
      })
      const promisedResults = Object.values(resultsObj)
      const output = {}

      const resolvedResultsObj = await Promise.all(promisedResults)
      for (const doc of resolvedResultsObj) {
        const invoiceData = btcPayInvoices.find(btcPayInvoice => btcPayInvoice.id === doc._id)
        output[doc._id] = {
          ...doc,
          btcPayInfo: invoiceData
        }
      }
      res.status(200).send(output)
    })
    .catch(err => {
      console.log('/invoiceTxs error: ', err)
    })
})

app.get(CONFIG.apiVersionPrefix + '/ ', function (req, res) {
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
        res.status(200).send({ message: 'Private key saved to server.', PK: keypair.priv })
      }
    }
    fs.writeFile(
      CONFIG.clientHexPrivateKeyFullPath,
      keypair.priv,
      { encoding: 'hex', flag: 'wx' },
      writeCallback
    )
  } catch (e) {
    console.log('Error in generating and saving private key.', e)
    res.status(500).send({ message: 'Error in generating and saving private key.' })
  }
})

app.get(CONFIG.apiVersionPrefix + '/getSupportedCurrencies', function (req, res) {
  res.status(200).send(CONFIG.supportedCurrencies)
})

app.get(CONFIG.apiVersionPrefix + '/pairClientWithServer', function (req, res) {
  // BASED on https://support.bitpay.com/hc/en-us/articles/115003001183-How-do-I-pair-my-client-and-create-a-token-
  // the received code needs to be plugged in to the btcpay server admin console to complete the pairing operation
  // to manually approve a pairing code (only needed once per client) for btcpay server visit: https://<your.btcpay.server.instance>/api-access-request?pairingCode=<your pairing code>
  // also see : https://github.com/btcpayserver/node-btcpay#Pairing

  let client
  console.log('pairClientWithServer()')
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

  try {
    client = getBtcPayClient()
    client
      .pair_client(CONFIG.oneTimePairingCode) // get this On BTCPay Server > Stores > Settings > Access Tokens > Create a new token, (leave PublicKey blank) > Request pairing
      .then(pairResponse => {
        console.log('pairResponse: ', pairResponse)
        if (pairResponse.merchant) {
          const pairResponseBuffer = Buffer.from(JSON.stringify(pairResponse))

          fs.writeFile(
            CONFIG.merchantPairingDataFullPath,
            pairResponseBuffer,
            { encoding: 'hex', flag: 'wx' },
            writeCallback
          )
          console.log('MERCHANT CODE:' + pairResponse.merchant)
          ENV.merchantData = pairResponse.merchant
          res.status(200).send({
            message: 'Merchant code saved to server.',
            merchantCode: pairResponse.merchant
          })
        } else {
          res.status(500).send({
            message: `Error while pairing client to BTCPay server at "${CONFIG.btcpayServerHostName}". Check BTCPay server configs, and make sure BTCPay server is up and running.`
          })
        }
      })
      .catch(e => {
        res.status(500).send({
          message: `Error while pairing client to BTCPay server at "${CONFIG.btcpayServerHostName}". Check BTCPay server configs, and make sure BTCPay server is up and running.`,
          e
        })
      })
  } catch (e) {
    res.status(500).send({
      message: `Error while pairing client to BTCPay server at "${CONFIG.btcpayServerHostName}". Check BTCPay server configs, and make sure BTCPay server is up and running.`,
      e
    })
  }
})

app.get(CONFIG.apiVersionPrefix + '/rates/:baseCurrency?/:currency?', function (req, res) {
  const baseCurrency = req.params.baseCurrency || 'BTC'
  const currency = req.params.currency || 'USD'
  const client = getBtcPayClient()
  client
    .get_rates(`${baseCurrency}_${currency}`, CONFIG.btcpayStoreId)
    .then(rates => {
      res.status(200).send({ message: 'Rates response', rates: rates })
    })
    .catch(err => {
      console.log(err)
      res.status(500).send({ message: 'Error in rates response', err: err })
    })
})

app.get(CONFIG.apiVersionPrefix + '/tests', function (req, res) {
  res.status(200).send({ test: true })
})

app.get(CONFIG.apiVersionPrefix + '/eosPrices/:currencyCode', function (req, res) {
  const { currencyCode } = req.params
  const lowerCaseCurrencyCode = currencyCode.toLowerCase()
  const resourcePrices = readEosPricesCacheJson()
  const chainSpecificResourcePrices = resourcePrices[lowerCaseCurrencyCode].data
  console.log('/eosPrices called: ', chainSpecificResourcePrices)
  res.status(200).send(chainSpecificResourcePrices)
})

app.get(CONFIG.apiVersionPrefix + '/startingResources/:currencyCode', function (req, res) {
  const { currencyCode } = req.params
  const lowerCaseCurrencyCode = currencyCode.toLowerCase()
  const { eosAccountActivationStartingBalances } = CONFIG.chains[lowerCaseCurrencyCode]
  console.log('eosAccountActivationStartingBalances: ', eosAccountActivationStartingBalances)
  const startingResourceNumbers = {
    ram: parseInt(eosAccountActivationStartingBalances.ram) / 1000,
    net: parseFloat(eosAccountActivationStartingBalances.net),
    cpu: parseFloat(eosAccountActivationStartingBalances.cpu)
  }
  res.status(200).send(startingResourceNumbers)
})

app.post(CONFIG.apiVersionPrefix + '/activateAccount', function (req, res) {
  // validate body
  const body = req.body
  const errors = []
  // expectedParams
  const bodyParams = [
    'currencyCode',
    'requestedAccountName',
    'ownerPublicKey',
    'activePublicKey',
    'requestedAccountCurrencyCode'
  ]

  let requestedPaymentCurrency = ''
  let requestedAccountName = ''
  let invoiceTx = {}

  const validations = [
    () => {
      // body has necessary parameters
      if (typeof body !== 'undefined' && typeof body === 'object' && body) {
        bodyParams.forEach(param => {
          // console.log(`Validating: ${param}...`)
          if (
            body.hasOwnProperty(param) &&
            typeof body[param] !== 'undefined' &&
            body[param] &&
            body[param].length > 0 &&
            typeof body[param] === 'string'
          ) {
            switch (param) {
              case 'currencyCode':
                console.log(`currency code requested : ${body[param]}`)
                if (isSupportedCurrency(body[param]) === false) {
                  errors.push(
                    getErrorObject(
                      'CurrencyNotSupported',
                      `This currency '${body[param]}' by this API is not supported at this time.`,
                      { supportedCurrencies: CONFIG.supportedCurrencies }
                    )
                  )
                } else {
                  requestedPaymentCurrency = body[param]
                }
                break
              case 'requestedAccountName':
                if (body[param].length !== 12) {
                  errors.push(
                    getErrorObject(
                      'InvalidAccountNameFormat',
                      `The requested account name "'${body[param]}'" is not 12 characters long. This server is not prepared to handle bidding on acccount names shorter than 12 characters for the EOS network.`
                    )
                  )
                }

                try {
                  format.encodeName(body[param]) // throws error on failed validation
                  requestedAccountName = body[param]
                } catch (e) {
                  errors.push(
                    getErrorObject(
                      'InvalidAccountNameFormat',
                      `The requested account name "'${body[param]}'" appears to be invalid.`,
                      e
                    )
                  )
                }
                break
              case 'ownerPublicKey':
              case 'activePublicKey':
                if (ecc.isValidPublic(body[param]) !== true) {
                  errors.push(
                    getErrorObject(
                      'InvalidEosKeyFormat',
                      `The key provided "'${body[param]}'" appears to be invalid.`
                    )
                  )
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
          getErrorObject('Invalid_POST_Body', 'No parameters were detected in the incoming body.')
        )
      }
    }
  ]

  validations.forEach((valFn, i) => {
    // console.log(`validation ${i}`)
    valFn()
  })

  if (errors.length > 0) {
    res.status(500).send(errors)
  } else {
    // get latest pricing for invoice
    getLatestEosActivationPriceInSelectedCryptoCurrency(
      requestedPaymentCurrency,
      body.requestedAccountCurrencyCode
    ).then(eosActivationFeeInSelectedCryptoUSD => {
      // createInvoice for payment & setup watcher
      const client = getBtcPayClient()
      client
        .create_invoice({
          price: eosActivationFeeInSelectedCryptoUSD,
          currency: 'USD',
          notificationEmail: CONFIG.invoiceNotificationEmailAddress || null,
          notificationURL: CONFIG.invoiceNotificationURL || null,
          extendedNotifications: true,
          physical: false
        }) // should have token?
        .then(invoice => {
          invoiceTx = formatCleanupInvoiceData(invoice)

          invoiceTx._id = invoice.id
          invoiceTx.requestedAccountName = requestedAccountName
          invoiceTx.ownerPublicKey = body.ownerPublicKey
          invoiceTx.activePublicKey = body.activePublicKey
          invoiceTx.requestedAccountCurrencyCode = body.requestedAccountCurrencyCode
          invoiceTx.eventStatusHistory = [
            {
              time: invoiceTx.currentTime,
              status: invoiceTx.status,
              event: null
            }
          ]
          const eosPricesCache = readEosPricesCacheJson()
          invoiceTx.quotedEosRates = {
            eosFees: eosPricesCache[body.requestedAccountCurrencyCode.toLowerCase()].data,
            eosActivationFeeInUSD: eosActivationFeeInSelectedCryptoUSD
          }

          // invoiceTx._rev = _rev
          invoiceTxDb.insert(invoiceTx, (err, insertResult) => {
            if (err) {
              console.log('invoiceTxDB error:', err)
              res.status(500).send({ message: 'Error saving transaction', error: err })
            } else {
              // console.log('invoiceTx.cryptoInfo: ', invoiceTx.cryptoInfo)

              const { totalDue, rate } = invoiceTx.cryptoInfo.filter(cryptoData => {
                return cryptoData.cryptoCode === requestedPaymentCurrency
              })[0]

              res.status(200).send({
                invoiceTx,
                currencyCode: requestedPaymentCurrency,
                paymentAddress:
                  invoiceTx.addresses && invoiceTx.addresses[requestedPaymentCurrency],
                expireTime: invoiceTx.expirationTime,
                amount: totalDue,
                rate: rate
              })
            }
          })
        })
        .catch(err => {
          console.log('Error creating invoice:', err)
          res.status(500).send({ message: 'error creating invoice', error: err })
        })
    })

    // once invoice is paid (on notification? Will btcpay notify URL)- send EOS payment command

    // eos.createAccountPackage('ownerPubKey', 'activePubKey', 'accountName', bytes, stake_net_quantity, stake_cpu_quantity, transfer)
  }
})

app.post(CONFIG.apiVersionPrefix + '/invoiceNotificationEvent', function (req, res) {
  // not sure why callback request body has different structure...?
  const invoiceId = req.body && (req.body.id || (req.body.data && req.body.data.id))
  const btcpayInvoiceEventCode =
    typeof req.body === 'object' && req.body.event && req.body.event.code
  const btcpayInvoiceEventName =
    typeof req.body === 'object' && req.body.event && req.body.event.name
  const invoiceEventData = formatCleanupInvoiceData(
    typeof req.body === 'object' && (req.body.data || req.body)
  )
  const invoiceTx = {}
  let _doUpdate = false
  const responseObject = {
    errors: [],
    warnings: [],
    messages: []
  }
  const btcPayNotificationResponse = {
    ok: () => {
      if (_doUpdate === false) {
        res.status(200).send({ message: 'ok' })
      } else {
        responseObject.messages.push({ message: 'ok' })
      }
    },
    error: (
      errorObj = getErrorObject(
        'NotificationEventError',
        'An error while processing BTCPay notification event'
      )
    ) => {
      console.log(errorObj.message, errorObj)
      if (_doUpdate === false) {
        res.status(500).send(errorObj)
      } else {
        responseObject.errors.push(errorObj)
      }
    },
    warning: (
      warningObject = getErrorObject(
        'NotificationEventWarning',
        'Something unhappy occurred while processing BTCPay notification event'
      )
    ) => {
      console.log(warningObject.message, warningObject)

      if (_doUpdate === false) {
        res.status(200).send(warningObject)
      } else {
        responseObject.warnings.push(warningObject)
      }
    }
  }
  const updateInvoiceData = invoiceTx => {
    invoiceTxDb.insert(invoiceTx, (err, insertResult) => {
      if (err) {
        console.log(
          getErrorObject('ErrorSavingInvoice', 'An error occurred while saving invoice.', err)
        )
        // res.status(500).send({message: 'Error saving transaction', error: err})
      } else {
        // console.log('Successsfully saved invoice from notification update.', responseObject)
        responseObject.messages.push(invoiceTx)
        res.status(200).send(responseObject)
      }
    })
  }

  console.log('invoiceEventData: ', invoiceEventData)

  // should we set a timeout here?

  const handleNotification = (err, invoiceData) => {
    if (err) {
      console.log(
        getErrorObject(
          'InvoiceTxDbError',
          'Failure retrieving invoice from database on btcpay notification.',
          err
        )
      )
    } else {
      // invoiceTx = Object.assign(invoiceData)

      for (const property in invoiceData) {
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
        case 1001: // invoice_created
        case 1002: // invoice_receivedPayment
        case 1003: // invoice_paidInFull
        case 1004: // invoice_expired
        case 1006: // invoice_completed
        case 1010: // invoice_expiredPartial
          // do nothing special
          _doUpdate = true
          btcPayNotificationResponse.ok()

          break

        case 1005: // invoice_confirmed
          // invoke eos broadcast call
          console.log('INVOICE CONFIRMED')
          _doUpdate = true
          const {
            requestedAccountName,
            ownerPublicKey,
            activePublicKey,
            requestedAccountCurrencyCode
          } = invoiceData
          const chain = requestedAccountCurrencyCode.toLowerCase()
          eosAccountCreateAndBuyBw(
            requestedAccountName,
            ownerPublicKey,
            activePublicKey,
            requestedAccountCurrencyCode
          )
            .then(result => {
              // to-do need to specify which currency's eosjs (eos) using in next line
              console.log('eosAccountCreateAndBuyBw result: ', result)
              chains[chain].eosJsInstance
                .getAccount({ account_name: chains[chain].creatorAccountName })
                .then(creatorAccountResult =>
                  console.log(
                    'eos creatorAccountName post transaction info: ',
                    creatorAccountResult
                  )
                )
                .catch(error => console.log('*************Error in getAccount: ', error))
              btcPayNotificationResponse.ok()
            })
            .catch(error => {
              btcPayNotificationResponse.error(
                getErrorObject(
                  'FailureInEosTxBroadcast',
                  'Something went wrong while broadcasting EOS transaction to network',
                  error
                )
              )
            })
          break
        case 1007: // invoice_refunded
        case 1016: // invoice_refundComplete
          // TODO: confirm setup disallows refunds
          _doUpdate = true
          btcPayNotificationResponse.ok()
          break
        case 1008: // invoice_markedInvalid
        case 1009: // invoice_paidAfterExpiration
          // TODO: confirm how to handle?
          btcPayNotificationResponse.warning()
          break

        case 1011: // invoice_blockedByTierLimit
        case 1012: // invoice_manuallyNotified
        case 1013: // invoice_failedToConfirm
        case 1014: // invoice_latePayment
        case 1015: // invoice_adjustmentComplete
          // log error / notification
          console.log('Unhandled Invoice Event received', req.body)
          _doUpdate = true
          btcPayNotificationResponse.warning(
            getErrorObject(
              'InvoiceStatusIrregularity',
              'Something unhappy occurred while processing BTCPay notification event.',
              req.body
            )
          )
          break

        case 2001: // payoutRequest_funded
        case 2002: // payoutRequest_completed
        case 2003: // payoutRequest_cancelled
          // Payouts are batches of bitcoin payments to employees, customers, partners, etc.
          // TODO: confirm payoutRequests cannot be invoked or are blocked by configuration
          console.log('Unhandled Payout Request Event received', req.body)
          btcPayNotificationResponse.warning(
            getErrorObject(
              'InvoicePayoutRequestWarning',
              'A BTCPay notification event for payout has been received, and should probably not have been.',
              req.body
            )
          )
          break

        case 3001: // org_completedSetup
          // TODO: confirm event conditions & handle if necessary
          btcPayNotificationResponse.warning(
            getErrorObject(
              'OrgCompletedSetupWarning',
              'A BTCPay notification event for org setup complete has been received, and should probably not have been.',
              req.body
            )
          )

          break
        default:
          btcPayNotificationResponse.warning(
            getErrorObject(
              'UnhandledNotificationEventWarning',
              'A BTCPay notification event for an unknown/unhandled Event has been received, and should probably not have been.',
              req.body
            )
          )
          break
      }

      if (_doUpdate) {
        updateInvoiceData(invoiceTx)
      }
    }
  }

  setTimeout(() => invoiceTxDb.get(invoiceId, handleNotification), 3000)

})

httpServer.listen(ENV.port, () => {
  console.log(`HTTP Server running on port ${ENV.port}`)
})

/***
 *      ___ ______________.____   _______________________________  _________
 *     /   |   \_   _____/|    |  \______   \_   _____/\______   \/   _____/
 *    /    ~    \    __)_ |    |   |     ___/|    __)_  |       _/\_____  \
 *    \    Y    /        \|    |___|    |    |        \ |    |   \/        \
 *     \___|_  /_______  /|_______ \____|   /_______  / |____|_  /_______  /
 *           \/        \/         \/                \/         \/        \/
 */

async function eosAccountCreateAndBuyBw (
  newAccountName,
  ownerPubKey,
  activePubKey,
  requestedAccountCurrencyCode
) {
  const chain = requestedAccountCurrencyCode.toLowerCase()
  const { creatorAccountName } = chains[chain]
  const CURRENCY_CONFIG = CONFIG.chains[chain]
  const { net, ram, cpu } = CURRENCY_CONFIG.eosAccountActivationStartingBalances

  // ///////////////////////////////////////////////////
  // Buy CPU and RAM
  const eosPricesCache = readEosPricesCacheJson()
  const eosPricingResponse = eosPricesCache[chain].data
  // apply minimum staked EOS amounts from Configs
  const stakeNetQuantity = bns.lt(
    bns.mul(eosPricingResponse.net.toString(), net),
    CURRENCY_CONFIG.eosAccountActivationStartingBalances.minimumNetEOSStake
  )
    ? CURRENCY_CONFIG.eosAccountActivationStartingBalances.minimumNetEOSStake
    : bns.mul(eosPricingResponse.net.toString(), net)
  const stakeCpuQuantity = bns.lt(
    bns.mul(eosPricingResponse.cpu.toString(), cpu),
    CURRENCY_CONFIG.eosAccountActivationStartingBalances.minimumCpuEOSStake
  )
    ? CURRENCY_CONFIG.eosAccountActivationStartingBalances.minimumCpuEOSStake
    : bns.mul(eosPricingResponse.cpu.toString(), cpu)

  const delegateBwOptions = {
    from: creatorAccountName,
    // receiver: 'edgytestey43',
    receiver: newAccountName,
    stake_net_quantity: `${Number(stakeNetQuantity).toFixed(
      4
    )} ${requestedAccountCurrencyCode}`,
    stake_cpu_quantity: `${Number(stakeCpuQuantity).toFixed(
      4
    )} ${requestedAccountCurrencyCode}`,
    transfer: 0
  }

  const txData = {
    actions: [{
      account: 'eosio',
      name: 'newaccount',
      authorization: [{
        actor: creatorAccountName,
        permission: 'active',
      }],
      data: {
        creator: creatorAccountName,
        name: newAccountName,
        owner: ownerPubKey, // <------ the public key the of the new user account that was generate by a wallet tool or the eosjs-keygen
        active: activePubKey
      },
    }, {
      account: 'eosio',
      name: 'delegatebw',
      authorization: [{
        actor: creatorAccountName,
        permission: 'active',
      }],
      data: delegateBwOptions,
    },{
      account: 'eosio',
      name: 'buyrambytes',
      authorization: [{
        actor: creatorAccountName,
        permission: 'active',
      }],
      data: {
        payer: creatorAccountName,
        receiver: newAccountName,
        bytes: parseInt(ram)
      }
    }]
  }

  for (const eosNode of shuffle(CONFIG.chains[chain].eosNodes)) {
    try {
      const temporaryEosjsConfig = {
        ...chains[chain].eosjsConfig,
        httpEndpoint: eosNode
      }
      const temporaryEosjsInstance = eosjs(temporaryEosjsConfig)
      await temporaryEosjsInstance.transaction(txData, {
        blocksBehind: 30,
        expireSeconds: 300,
        sign: true,
        broadcast: true,

      })
    } catch (err) {
      console.log('create account tx for ', newAccountName, ' failed on ', requestedAccountCurrencyCode, 'with node ', eosNode, 'with error: ', err)
    }
  }
}

function getBtcPayClient () {
  let client
  try {
    client = new btcpay.BTCPayClient(`https://${CONFIG.btcpayServerHostName}`, keypair, {
      merchant: merchantKey
    })
  } catch (e) {
    throw new Error('Error in getBtcPayClient: ', e)
  }

  return client
}

function formatCleanupInvoiceData(invoiceTxData) {
  console.log('formatCleanupInvoiceData called')
  const _returnObj = {}

  CONFIG.btcPayInvoicePropsToSave.forEach(prop => {
    switch (true) {
      case invoiceTxData[prop] !== null && typeof invoiceTxData[prop] !== 'undefined':
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
        console.log(`${prop} not available on invoice object. Check configs for properties to save`)
        break
    }
  })

  // console.log('_formatCleanupInvoiceData()', _returnObj)

  return _returnObj
}

function getErrorObject (errorCode, message, data) {
  const error = {}
  for (const arg in arguments) {
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
        // do nothing
        break
    }
  }

  return error
}

function isSupportedCurrency (currencyCode) {
  console.log(
    `isSupportedCurrency() ${currencyCode}`,
    currencyCode,
    typeof currencyCode,
    CONFIG.supportedCurrencies.hasOwnProperty(currencyCode)
  )
  let _returnVal = false

  _returnVal = !!(
    currencyCode &&
    typeof currencyCode === 'string' &&
    CONFIG.supportedCurrencies.hasOwnProperty(currencyCode) &&
    CONFIG.supportedCurrencies[currencyCode]
  )

  // console.log(`isSupportedCurrency() : ${_returnVal}`)
  return _returnVal
}


const checkPaidNotCreated = async () => {
  const nowTimestamp = Date.now()  / 1000
  const invoices = await btcPayClient.get_invoices()
  const recentCompletedInvoices = invoices.filter(invoice => {
    const isLastWeek = (nowTimestamp - (invoice.invoiceTime / 1000)) < (60 * 60 * 24 * 7 * 4)
    return invoice.status === 'complete' && isLastWeek
  })
  // console.log('recentCompletedInvoices: ', recentCompletedInvoices)
  for (const completedInvoice of recentCompletedInvoices) {
    const dbDoc = await invoiceTxDb.get(completedInvoice.id)
    // console.log('dbDoc: ', dbDoc)
    const { activePublicKey, ownerPublicKey, requestedAccountCurrencyCode, requestedAccountName } = dbDoc
    const chain = requestedAccountCurrencyCode.toLowerCase()
    // console.log('requestedAccountName: ', requestedAccountName)
    try {
      const endpoint = chains[chain].HYPERION_ENDPOINT
      const url = `${endpoint}/v2/state/get_account?account=${requestedAccountName}`
      const response = await axios({
        url
      })
      console.log('requestedAccountName exists for: ', requestedAccountName)
    } catch (error) {
      console.log(requestedAccountName, ' does not exist')
      try {
        eosAccountCreateAndBuyBw(
          requestedAccountName,
          ownerPublicKey,
          activePublicKey,
          requestedAccountCurrencyCode
        )
      } catch (err) {
        console.log('eosAccountCreateAndBuyBw failing inside of checkPaidNotCreated')
      }
    }
  }
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

setTimeout(checkPaidNotCreated, 30000)
// repeat every 5 minutes
setInterval(checkPaidNotCreated, 60 * 30 * 1000)