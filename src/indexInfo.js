// indexAuth.js
// @flow
// BASE SETUP
// =============================================================================

import fs from 'fs'
import http from 'http'
import https from 'https'
import express from 'express'        // call express
import bodyParser from 'body-parser'
import cors from 'cors'
import nano from 'nano'
import promisify from 'promisify-node'
import { checkServers } from './checkServers.js'

const CONFIG = require('../serverConfig.json')
const LOOP_DELAY_MS = 1000 * 60 * 60 // Delay an hour between checks

// call the packages we need
const app = express()                 // define our app using express

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
const router = express.Router()              // get an instance of the express Router

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
    let electrumServers = {
      BTC: [],
      BC1: [],
      BC2: [],
      LTC: [],
      BCH: [],
      DASH: []
    }
    try {
      const results = await dbAuth.get('electrumServers')
      if (typeof results.BTC === 'undefined') {
        throw new Error('Missing BTC servers')
      }
      electrumServers = results
    } catch (e) {
      console.log(dateString())
      console.log(e)
    }

    try {
      mylog('***********************************')
      mylog(dateString() + ': Calling checkServers')
      const seedServers = electrumServers.BTC.concat(electrumServers.BC1).concat(electrumServers.BC2).concat(electrumServers.BCH).concat(electrumServers.LTC).concat(electrumServers.DASH)
      const results = await checkServers(seedServers)
      console.log(dateString())
      console.log(results)
      if (
        typeof results !== 'undefined' &&
        results.nonSegwitServers.length >= 3 &&
        results.coreServers.length >= 3 &&
        results.bchServers.length >= 3 &&
        results.ltcServers.length >= 3
      ) {
        electrumServers.BTC = results.nonSegwitServers
        electrumServers.BC1 = results.coreServers
        electrumServers.BC2 = results.btc2xServers
        electrumServers.BCH = results.bchServers
        electrumServers.LTC = results.ltcServers
        electrumServers.DASH = results.dashServers
        await dbAuth.insert(electrumServers, 'electrumServers')
      }
    } catch (e) {
      console.log(dateString())
      console.log(e)
    }
    await snooze(LOOP_DELAY_MS)
  }
}

engineLoop()
