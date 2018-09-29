// @flow

import type { CheckServerInfo } from './serverInfos.js'
const net = require('net')
const tls = require('tls')
const { getPeers } = require('./getPeers.js')
// const { serverInfos, seedServers } = require('./serverInfos.js')
// const _serverInfos = serverInfos

// const SEED_SERVERS = seedServers

let _serverInfos: { [currencyCode: string]: CheckServerInfo } = {}

type CheckServersResponse = {
  [currencyCode: string]: Array<string>
}

async function checkServers (
  serverList:Array<string>,
  serverInfos: { [currencyCode: string]: CheckServerInfo }): Promise<CheckServersResponse> {
  _serverInfos = serverInfos
  let servers = serverList
  let startServers = servers.slice()
  let promiseArray = []

  //
  // Loop over all servers
  //
  let getPeersResults:Array<any> = []
  for (let server of servers) {
    console.log('Getting peers from server:' + server)
    const p = getPeers(server)
    promiseArray.push(p)
    if (promiseArray.length >= 200) {
      getPeersResults = getPeersResults.concat(await Promise.all(promiseArray))
      promiseArray = []
    }
  }

  getPeersResults = getPeersResults.concat(await Promise.all(promiseArray))

  for (const result of getPeersResults) {
    // Each result is an array of peers or -1 if that server failed
    if (result.peers === -1) {
      _serverInfos.BAD.serverList.push({serverUrl: result.serverUrl, blockHeight: 0})
    } else {
      startServers = startServers.concat(result.peers)
    }
  }

  let uniqueServers = Array.from(new Set(startServers))
  // let uniqueServers = SEED_SERVERS
  console.log('Found ' + uniqueServers.length + ' unique peers to check')

  promiseArray = []
  // uniqueServers = ['electrum://electrum-bu-az-wjapan.airbitz.co:50001', 'electrum://electrum-bu-az-weuro.airbitz.co:50001']
  // uniqueServers = ['electrum://cluelessperson.com:50001']
  // uniqueServers = ['electrum://electrum-ltc.petrkr.net:60001', 'electrum://electrum-ltc.festivaldelhumor.org:60001']

  let results: Array<ServerResults | null> = []

  for (let svr of uniqueServers) {
    console.log('Checking server:' + svr)
    const p = checkServer(svr)
    promiseArray.push(p)
    if (promiseArray.length >= 50) {
      results = results.concat(await Promise.all(promiseArray))
      console.log('Writing results up to: ' + results.length)
      promiseArray = []
    }
  }

  results = results.concat(await Promise.all(promiseArray))

  for (const result: ServerResults | null of results) {
    if (!result) {
      continue
    }
    const serverUrl = result.serverUrl
    const blockHeight = result.blockHeight

    let matchCc = ''
    let coreCC = ''
    for (const cc in _serverInfos) {
    // for (let idx = 0; idx < _serverInfos.length; idx++) {
      // Hack to match Core server type
      if (_serverInfos[cc].currencyCode === 'BC1') {
        coreCC = cc
      }
      if (result.currencyCode === _serverInfos[cc].currencyCode) {
        matchCc = cc
      }
    }

    // Hack to match Core segwit server type
    if (result.currencyCode === 'BTC' &&
      _serverInfos[coreCC].wantSegwit === result.hasSegwit &&
      _serverInfos[coreCC].wantElectrumX === result.electrumx &&
      _serverInfos[coreCC].wantV11 === result.v11
    ) {
      _serverInfos[coreCC].serverList.push({serverUrl, blockHeight})
    }

    if (matchCc === '') {
      continue
    }

    if (_serverInfos[matchCc].wantSegwit !== result.hasSegwit) {
      continue
    }

    if (_serverInfos[matchCc].wantElectrumX && !result.electrumx) {
      continue
    }

    if (_serverInfos[matchCc].wantV11 && !result.v11) {
      continue
    }

    _serverInfos[matchCc].serverList.push({serverUrl, blockHeight})
  }

  const finalServers: CheckServersResponse = {}
  for (const cc in _serverInfos) {
    const serverInfo = _serverInfos[cc]
    console.log(`Pruning low blockheights for ${cc}`)
    const temp1 = pruneLowBlockHeight(serverInfo.serverList)
    const temp2 = new Set(temp1)
    const temp3 = [...temp2]
    finalServers[serverInfo.currencyCode] = temp3
  }

  for (const cc in finalServers) {
    if (!finalServers.hasOwnProperty(cc)) continue
    const servers = finalServers[cc]
    console.log(`\n ${servers.length} ${cc} SERVERS:\n`)
    for (let s of servers) {
      console.log(s)
    }
  }

  for (const cc in finalServers) {
    if (!finalServers.hasOwnProperty(cc)) continue
    const servers = finalServers[cc]
    console.log(`num ${cc}      : ${servers.length}`)
  }

  return finalServers
}

// Remove the servers which have lower blockHeights than the majority of other servers
function pruneLowBlockHeight (servers: Array<{serverUrl: string, blockHeight: number}>) {
  const heights = {}
  for (const s of servers) {
    if (typeof heights[s.blockHeight] === 'undefined') {
      heights[s.blockHeight] = 1
    } else {
      heights[s.blockHeight] += 1
    }
  }
  console.log('Heights object:', heights)

  let highestScore: number = 0
  let heightWithHighestScore: number = 0
  for (const s in heights) {
    if (!heights.hasOwnProperty(s)) continue
    if (heights[s] >= highestScore) {
      highestScore = heights[s]
      const newHeight = parseInt(s)
      if (newHeight > heightWithHighestScore) {
        heightWithHighestScore = newHeight
      }
    }
  }
  console.log('highestScore:' + highestScore)
  console.log('heightWithHighestScore:' + heightWithHighestScore)

  const out = []
  for (const s of servers) {
    if (
      s.blockHeight >= heightWithHighestScore - 1 &&
      s.blockHeight <= heightWithHighestScore + 1
    ) {
      out.push(s.serverUrl)
    } else {
      console.log('Low blockheight: ' + s.serverUrl + ': ' + s.blockHeight)
    }
  }
  return out
}

type ServerChecks = {
  checkVersion: boolean,
  checkHeader: boolean,
  checkHeight: boolean,
  checkTxSegwit: boolean,
  checkTxNonSegwit: boolean
}

type ServerResults = {
  checks: ServerChecks,
  currencyCode: string,
  hasSegwit: boolean | null,
  blockHeight: number,
  serverUrl: string,
  v11: boolean | null,
  electrumx: boolean | null
}

type QueryCommand = {
  cmdString: string,
  resultHandler: (result: Object) => boolean
}

const blankQuery = {
  cmdString: '',
  resultHandler: (result) => { return false }
}

function checkVersion (serverResults: ServerResults): QueryCommand {
  return {
    cmdString: '{ "id": __ID__, "method": "server.version", "params": ["1.1", "1.1"] }\n',
    resultHandler: (resultObj: Object) => {
      if (typeof resultObj.result !== 'undefined') {
        const result = resultObj.result
        if (typeof result === 'object' && result.length === 2) {
          // Only accept ElectrumX servers since they don't prune history
          serverResults.v11 = (parseFloat(result[1]) >= 1.1)
          serverResults.electrumx = result[0].toLowerCase().includes('electrumx')
        } else if (typeof result === 'string') {
          serverResults.v11 = false
          serverResults.electrumx = result.toLowerCase().includes('electrumx')
        } else {
          return false
        }
      } else {
        return false
      }
      serverResults.checks.checkVersion = true
      return true
    }
  }
}

function checkHeight (serverResults: ServerResults): QueryCommand {
  return {
    cmdString: '{ "id": __ID__, "method": "blockchain.headers.subscribe", "params": [] }\n',
    resultHandler: (resultObj: Object) => {
      if (typeof resultObj.result !== 'undefined') {
        serverResults.blockHeight = resultObj.result.block_height
        serverResults.checks.checkHeight = true
        return true
      }
      return false
    }
  }
}

function checkHeader1k (serverResults: ServerResults): QueryCommand {
  return {
    cmdString: '{ "id": __ID__, "method": "blockchain.block.get_header", "params": [ 1000 ] }\n',
    resultHandler: (resultObj: Object) => {
      if (
        typeof resultObj.result !== 'undefined' &&
        typeof resultObj.result.merkle_root !== 'undefined'
      ) {
        for (const cc in _serverInfos) {
          const serverInfo = _serverInfos[cc]
          if (resultObj.result.merkle_root === serverInfo.blockMerkle1k) {
            serverResults.checks.checkHeader = true
            serverResults.currencyCode = serverInfo.currencyCode
          }
        }
        return true
      }
      return false
    }
  }
}

function checkHeader500k (serverResults: ServerResults): QueryCommand {
  return {
    cmdString: '{ "id": __ID__, "method": "blockchain.block.get_header", "params": [ 500000 ] }\n',
    resultHandler: (resultObj: Object) => {
      if (
        typeof resultObj.result !== 'undefined' &&
        typeof resultObj.result.merkle_root !== 'undefined'
      ) {
        for (const cc in _serverInfos) {
          const serverInfo = _serverInfos[cc]
          if (resultObj.result.merkle_root === serverInfo.blockMerkle500k) {
            serverResults.checks.checkHeader = true
            serverResults.currencyCode = serverInfo.currencyCode
          }
        }
        return true
      }
      return false
    }
  }
}

function checkHeader1400k (serverResults: ServerResults): QueryCommand {
  return {
    cmdString: '{ "id": __ID__, "method": "blockchain.block.get_header", "params": [ 1400000 ] }\n',
    resultHandler: (resultObj: Object) => {
      if (
        typeof resultObj.result !== 'undefined' &&
        typeof resultObj.result.merkle_root !== 'undefined'
      ) {
        for (const cc in _serverInfos) {
          const serverInfo = _serverInfos[cc]
          if (resultObj.result.merkle_root === serverInfo.blockMerkle1400k) {
            serverResults.checks.checkHeader = true
            serverResults.currencyCode = serverInfo.currencyCode
          }
        }
        return true
      }
      return false
    }
  }
}

function checkTxid (serverResults: ServerResults, serverInfo: CheckServerInfo): QueryCommand {
  return {
    cmdString: `{ "id": __ID__, "method": "blockchain.transaction.get", "params": ["${serverInfo.checkTxid}"] }\n`,
    resultHandler: (resultObj: Object) => {
      if (typeof resultObj.result !== 'undefined') {
        if (resultObj.result.toLowerCase().includes(serverInfo.txRawNonSegwit)) {
          serverResults.hasSegwit = false
        } else if (resultObj.result.toLowerCase().includes(serverInfo.txRawSegwit)) {
          serverResults.hasSegwit = true
        } else {
          return false
        }
        serverResults.checks.checkTxSegwit = true
        serverResults.checks.checkTxNonSegwit = true
        return true
      }
      return false
    }
  }
}

function checkServer (serverUrl: string): Promise<ServerResults | null> {
  return new Promise((resolve) => {
    let regex
    let ssl = false
    if (typeof serverUrl !== 'string') {
      resolve(null)
    }
    if (serverUrl.startsWith('electrums:')) {
      regex = new RegExp(/electrums:\/\/(.*):(.*)/)
      ssl = true
    } else {
      regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    }
    let results = regex.exec(serverUrl)

    let client

    const serverResults: ServerResults = {
      checks: {
        checkVersion: false,
        checkHeight: false,
        checkHeader: false,
        checkTxSegwit: false,
        checkTxNonSegwit: false
      },
      currencyCode: '',
      hasSegwit: null,
      blockHeight: 0,
      serverUrl: serverUrl,
      v11: null,
      electrumx: null
    }

    if (results === null) {
      resolve(null)
    } else {
      let resolved = false
      let id = 0
      const port = results[2]
      const host = results[1]
      let tcp
      if (ssl) {
        tcp = tls
      } else {
        tcp = net
      }

      const queries: Array<QueryCommand> = []
      client = tcp.connect({ port, host, rejectUnauthorized: false }, () => {
        queries.push(blankQuery)
        queries.push(checkVersion(serverResults))
        queries.push(checkHeight(serverResults))
        queries.push(checkHeader1k(serverResults))
        queries.push(checkHeader500k(serverResults))
        queries.push(checkHeader1400k(serverResults))

        for (const q of queries) {
          if (q.cmdString.length > 0) {
            const cmd = q.cmdString.replace('__ID__', id.toString())
            client.write(cmd)
          }
          id++
        }
      })

      let jsonData = ''
      let queryTxids = false

      client.on('data', (data) => {
        let results = data.toString('ascii')
        console.log('\nBEGIN data for ' + serverUrl)
        console.log(results)
        console.log('END data for ' + serverUrl + '\n')

        let arrayResults = []

        try {
          const resultObj = JSON.parse(jsonData + results)
          arrayResults.push(resultObj)
        } catch (e) {
          // Check if this is a multiline response by breaking up into arrays by newline
          const nlSplits = (jsonData + results).split('\n')
          if (nlSplits.length > 0) {
            for (const sp of nlSplits) {
              try {
                const resultObj = JSON.parse(sp)
                arrayResults.push(resultObj)
              } catch (e) {
                jsonData += sp
              }
            }
          } else {
            jsonData += results
            return
          }
        }

        // Send results to the appropriate handler
        for (const result of arrayResults) {
          if (typeof result.id === 'number') {
            queries[result.id].resultHandler(result)
          }
        }

        if (
          serverResults.checks.checkVersion === true &&
          serverResults.checks.checkHeight === true &&
          serverResults.checks.checkHeader === true &&
          queryTxids === false
        ) {
          // See which serverInfo currencyCode matches this server
          let serverInfo: CheckServerInfo | null = null
          for (const cc in _serverInfos) {
            const s = _serverInfos[cc]
            if (s.currencyCode === serverResults.currencyCode) {
              serverInfo = s
            }
          }

          if (!serverInfo) {
            resolved = true
            resolve(null)
            return
          }

          // Push txid queries specific for that currency code serverInfo
          const q2 = checkTxid(serverResults, serverInfo)
          const cmd2 = q2.cmdString.replace('__ID__', id.toString())
          queries.push(q2)
          client.write(cmd2)
          queryTxids = true
        } else if (queryTxids) {
          // Check to see if we have all results needed
          if (
            serverResults.checks.checkTxNonSegwit === true &&
            serverResults.checks.checkTxSegwit === true
          ) {
            resolved = true
            client.write('Goodbye!!!')
            resolve(serverResults)
          }
        }
      })

      client.on('error', (err) => {
        const e = err.code ? err.code : ''
        console.log(`${serverUrl}: Socket ERROR: ${e}`)
        resolved = true
        resolve(null)
      })

      client.on('close', () => {
        console.log(`${serverUrl}: Socket close`)
        resolved = true
        resolve(serverResults)
      })

      client.on('end', () => {
        console.log(`${serverUrl}: Socket end`)
        resolved = true
        resolve(serverResults)
      })

      setTimeout(() => {
        if (!resolved) {
          client.destroy()
          console.log(`${serverUrl}: Socket timeout`)
          resolve(null)
        }
      }, 10000)
    }
  })
}

module.exports = { checkServers }
