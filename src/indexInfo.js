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

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cors())

// const port = process.env.PORT || 8085        // set our port
let credentials = {}

try {
  credentials = {
    key: fs.readFileSync(CONFIG.sslPrivateKeyPath, 'utf8'),
    cert: fs.readFileSync(CONFIG.sslCertPath, 'utf8')
  }
} catch (e) {
  mylog(e)
}

// Nano for CouchDB
// =============================================================================
const nanoDb = nano(CONFIG.dbFullpath)
const dbAuth = nanoDb.db.use('db_info')
promisify(dbAuth)

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router()              // get an instance of the express Router

// middleware to use for all requests
router.use(function (req, res, next) {
  // do logging

  mylog('Something is happening.')
  next() // make sure we go to the next routes and don't stop here
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

// middleware to use for all requests
router.use(function (req, res, next) {
  // do logging
  mylog('Something is happening.')
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
    let electrumServers = {BTC: []}
    try {
      const results = await dbAuth.get('electrumServers')
      if (typeof results.BTC === 'undefined') {
        throw new Error('Missing BTC servers')
      }
      electrumServers = results
    } catch (e) {
      console.log(e)
    }

    try {
      const results = await checkServers(electrumServers.BTC)
      console.log(results)
      if (typeof results !== 'undefined') {
        electrumServers.BTC = results.goodServers
        await dbAuth.insert(electrumServers, 'electrumServers')
      }
    } catch (e) {
      console.log(e)
    }
    await snooze(LOOP_DELAY_MS)
  }
}

engineLoop()
