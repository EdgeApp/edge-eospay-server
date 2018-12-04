// indexAuth.js
// @flow
// BASE SETUP
// =============================================================================

const fs = require('fs')
const http = require('http')
const https = require('https')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const nano = require('nano')
const promisify = require('promisify-node')
const { checkServers } = require('./checkServers.js')

const CONFIG = require('../serverConfig.json')
const LOOP_DELAY_MS = 1000 * 60 * 60 // Delay an hour between checks
const REQUIRED_CODES = ['BTC', 'BC1', 'DASH', 'LTC', 'BCH']

// call the packages we need
const app = express()

const mylog = console.log

function snooze (ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function dateString () {
  const date = new Date()
  return date.toDateString() + ':' + date.toTimeString()
}

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}))
app.use(cors())

// const port = process.env.PORT || 8085        // set our port
let credentials = {}

try {
  credentials = {
    key: fs.readFileSync(CONFIG.sslPrivateKeyPath, 'utf8'),
    cert: fs.readFileSync(CONFIG.sslCertPath, 'utf8'),
    ca: fs.readFileSync(CONFIG.sslCaCertPath, 'utf8')
  }
} catch (e) {
  mylog(e)
}

// Nano for CouchDB
// =============================================================================
const nanoDb = nano(CONFIG.dbFullpath)
const dbAuth = nanoDb.db.use('db_info')
const dbLogs = nanoDb.db.use('db_logs')
promisify(dbAuth)
promisify(dbLogs)

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router()

// middleware to use for all requests
router.use(function (req, res, next) {
  // do logging

  mylog('Something is happening.')
  next() // make sure we go to the next routes and don't stop here
})

router.post('/addLogs/', function (req, res) {
  console.log('ADD LOGS REQUEST', req.body.data.length)
  var d = new Date()
  dbLogs.insert({data: req.body.data}, d.toISOString(), function (err, body) {
    console.log(err, body)
  })
  res.json({
    'status': 'ok'
  })
})

router.get('/syncServers', function (req, res) {
  mylog('API /syncServers')
  dbAuth.get('syncServers').then(syncServers => {
    res.json(syncServers)
  }).catch(err => {
    res.json(err)
  })
})

router.get('/currencyInfo/:currencyCode', function (req, res) {
  mylog('API /currencyInfo/' + req.params.currencyCode)
  dbAuth.get('currencyInfo').then(currencyInfo => {
    if (typeof currencyInfo[req.params.currencyCode] === 'object') {
      res.json(currencyInfo[req.params.currencyCode])
    } else {
      res.json('Unable to find currencyInfo ' + req.params.currencyCode)
    }
  }).catch(err => {
    res.json(err)
  })
})

router.get('/airbitzChainChoice/:apiKey', function (req, res) {
  mylog('API /airbitzChainChoice/' + req.params.apiKey)
  dbAuth.get('airbitzChainChoice').then(airbitzChainChoice => {
    if (typeof airbitzChainChoice[req.params.apiKey] === 'object') {
      res.json(airbitzChainChoice[req.params.apiKey])
    } else {
      res.json(airbitzChainChoice['default'])
    }
  }).catch(err => {
    res.json(err)
  })
})

router.get('/electrumServers/:currencyCode', function (req, res) {
  mylog('API /electrumServers/' + req.params.currencyCode)
  dbAuth.get('electrumServers').then(electrumServers => {
    if (typeof electrumServers[req.params.currencyCode] === 'object') {
      res.json(electrumServers[req.params.currencyCode])
    } else {
      res.json('Unable to find electrumServers ' + req.params.currencyCode)
    }
  }).catch(err => {
    res.json(err)
  })
})

router.get('/airbitzCurrencyInfo/:currencyCode', function (req, res) {
  mylog('API /airbitzCurrencyInfo/' + req.params.currencyCode)
  dbAuth.get('airbitzCurrencyInfo').then(airbitzCurrencyInfo => {
    if (typeof airbitzCurrencyInfo[req.params.currencyCode] === 'object') {
      res.json(airbitzCurrencyInfo[req.params.currencyCode])
    } else {
      res.json('Unable to find airbitzCurrencyInfo ' + req.params.currencyCode)
    }
  }).catch(err => {
    res.json(err)
  })
})

router.get('/networkFees/:currencyCode', function (req, res) {
  mylog('API /networkFees/' + req.params.currencyCode)

  dbAuth.get('networkFees').then(networkFees => {
    if (typeof networkFees[req.params.currencyCode] === 'object') {
      res.json(networkFees[req.params.currencyCode])
    } else {
      res.json('Unable to find networkFees ' + req.params.currencyCode)
    }
  }).catch(err => {
    res.json(err)
  })
})

router.get('/appIdInfo/:appId', function (req, res) {
  mylog('API /appIdInfo/' + req.params.appId)

  dbAuth.get('appIdInfo').then(networkFees => {
    if (typeof networkFees[req.params.appId] === 'object') {
      res.json(networkFees[req.params.appId])
    } else {
      res.json('Unable to find app id ' + req.params.appId)
    }
  }).catch(err => {
    res.json(err)
  })
})

router.get('/appIdInfo', function (req, res) {
  mylog('API /appIdInfo/')

  dbAuth.get('appIdInfo').then(networkFees => {
    if (typeof networkFees['co.edgesecure'] === 'object') {
      res.json(networkFees['co.edgesecure'])
    } else {
      res.json('Unable to find app id (blank string) ')
    }
  }).catch(err => {
    res.json(err)
  })
})

// middleware to use for all requests
router.use(function (req, res, next) {
  // do logging
  mylog(dateString() + 'Something is happening.')
  next() // make sure we go to the next routes and don't stop here
})

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/v1', router)

// START THE SERVER
// =============================================================================
const httpServer = http.createServer(app)
const httpsServer = https.createServer(credentials, app)

httpServer.listen(CONFIG.httpPort)
httpsServer.listen(CONFIG.httpsPort)

mylog('Express server listening on port:' + CONFIG.httpPort + ' ssl:' + CONFIG.httpsPort)

// Startup background tasks
async function engineLoop () {
  while (1) {
    let seedServers = []
    let electrumServerInfos = {}
    let electrumServers = {}
    let _id
    let _rev
    try {
      let results = await dbAuth.get('electrumServers')
      if (typeof results.BTC === 'undefined') {
        throw new Error('Missing BTC servers')
      }
      _id = results._id
      _rev = results._rev
      delete results._id
      delete results._rev
      electrumServers = results

      results = await dbAuth.get('electrumServerInfos')
      if (typeof results.BC1 === 'undefined') {
        throw new Error('Missing BTC serverInfo')
      }
      delete results._id
      delete results._rev
      electrumServerInfos = results

      results = await dbAuth.get('seedServers')
      if (typeof results.servers === 'undefined') {
        throw new Error('Missing seedServers')
      }
      seedServers = results.servers
    } catch (e) {
      console.log(dateString())
      console.log(e)
    }

    try {
      mylog('***********************************')
      mylog(dateString() + ': Calling checkServers')
      for (const s in electrumServers) {
        seedServers = seedServers.concat(electrumServers[s])
      }
      const results = await checkServers(seedServers, electrumServerInfos)
      console.log(dateString())
      console.log(results)

      for (const cc in results) {
        if (results[cc].length < 2 && cc !== 'BAD') {
          console.log(`Too few servers for ${cc}. Using old list`)
          results[cc] = electrumServers[cc]
        }
      }

      for (const codes of REQUIRED_CODES) {
        if (results[codes] === undefined) {
          throw new Error('Too few currency codes')
        }
      }
      electrumServers = Object.assign(electrumServers, results)
      electrumServers._id = _id
      electrumServers._rev = _rev
      await dbAuth.insert(electrumServers, 'electrumServers')
    } catch (e) {
      console.log(dateString())
      console.log(e)
    }
    mylog('SNOOZING ***********************************')
    await snooze(LOOP_DELAY_MS)
  }
}

engineLoop()
