// @flow

const net = require('net')
const tls = require('tls')
const { getPeers } = require('./getPeers.js')

type CheckServerInfo = {
  serverList: Array<{serverUrl: string, blockHeight: number}>,
  currencyCode: string,
  blockMerkle500k: string,
  blockMerkle1400k: string,
  checkTxid: string,
  txRawSegwit: string | null,
  txRawNonSegwit: string | null,
  wantSegwit: boolean,
  wantV11: boolean,
  wantElectrumX: boolean
}

const _bc1ServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BC1',
  blockMerkle500k: '31951c69428a95a46b517ffb0de12fec1bd0b2392aec07b64573e03ded31621f',
  blockMerkle1400k: '',
  checkTxid: 'ef298148f25162db85127b83daefe07e46b06078f95aa30969b007a09a722b61',
  txRawSegwit: '01000000000102f8a7d578817bb42636a2552de53db82',
  txRawNonSegwit: '0100000002f8a7d578817bb4',
  wantSegwit: true,
  wantV11: true,
  wantElectrumX: true
}

const _btcServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BTC',
  blockMerkle500k: '31951c69428a95a46b517ffb0de12fec1bd0b2392aec07b64573e03ded31621f',
  blockMerkle1400k: '',
  checkTxid: 'ef298148f25162db85127b83daefe07e46b06078f95aa30969b007a09a722b61',
  txRawSegwit: '01000000000102f8a7d578817bb42636a2552de53db82',
  txRawNonSegwit: '0100000002f8a7d578817bb4',
  wantSegwit: false,
  wantV11: false,
  wantElectrumX: true
}

const _ltcServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'LTC',
  blockMerkle500k: '2a5a10a1fdfb8f1d4278fb15a04d5b0b1d0859f711172528478fceb40dfdb199',
  blockMerkle1400k: '',
  checkTxid: '0a3d7d238a4b91386b78b477490e21927f94b65e5f107d1c9db2a545a1bfd968',
  txRawSegwit: '01000000000101b94c5ae03c29a936d226205495eed6aeaa44f8a13df7fd83595b5411f5caefa60100000017160',
  txRawNonSegwit: null,
  wantSegwit: true,
  wantV11: true,
  wantElectrumX: true
}

const _bchServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BCH',
  blockMerkle500k: '4af279645e1b337e655ae3286fc2ca09f58eb01efa6ab27adedd1e9e6ec19091',
  blockMerkle1400k: '',
  checkTxid: '93fc1366642e328fdfa87d7e1c59e5d06216eecb7f836845b346ccf06e73ee95',
  txRawSegwit: null,
  txRawNonSegwit: '01000000013b0d0868079c7926dd0d91d57ee79482b2a437c2a070dcada0d8745b8f001099000000006b48304502210094695303fb22be1c9174d8cf9679c0cb4ead134b2ac21361f06b5954320c8b4802200171c3267664cc3b2449d07c5bfb57eb815fb6dac6641baacfba8730bc32f4604121021eb65684bd854bf34d',
  wantSegwit: false,
  wantV11: true,
  wantElectrumX: true
}

const _dashServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'DASH',
  blockMerkle500k: '9d0ee1ce292af212d2f864482faff376b81a20c72c256c053d870e064c919de4',
  blockMerkle1400k: '',
  checkTxid: '43cdc29b486d6030b077b73be0439eb3f229ddaffff805bcead32d0a07fff094',
  txRawSegwit: null,
  txRawNonSegwit: '0100000001f29662799c0f63dba9ceeffa1876a916b5b9b085e8c422ae15d1d44a1bc4eb64010000006a47304402201850c519a44488c12f8a9fbace8fb268921f9436b8951a46d3777ab25c7ecc450220321eca800b898b0b62ec44e114fe29151d9fe54b0e7012e1a70d22db30046a3c012102cd93a',
  wantSegwit: false,
  wantV11: true,
  wantElectrumX: true
}

const _badServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BAD',
  blockMerkle500k: '',
  blockMerkle1400k: '',
  checkTxid: '',
  txRawSegwit: null,
  txRawNonSegwit: null,
  wantSegwit: false,
  wantV11: false,
  wantElectrumX: false
}

const _serverInfos: Array<CheckServerInfo> = [
  _badServerInfo,
  _bc1ServerInfo,
  _btcServerInfo,
  _ltcServerInfo,
  _bchServerInfo,
  _dashServerInfo
]

const SEED_SERVERS = [
  'electrum://electrum.jdubya.info:50001',
  'electrums://electrum-bc-az-eusa.airbitz.co:50002',
  'electrum://electrum-bc-az-eusa.airbitz.co:50001',
  'electrums://electrum-bu-az-wusa2.airbitz.co:50002',
  'electrum://electrum-bu-az-wusa2.airbitz.co:50001',
  'electrums://electrum-bu-az-wjapan.airbitz.co:50002',
  'electrum://electrum-bu-az-wjapan.airbitz.co:50001',
  'electrums://electrum-bu-az-ausw.airbitz.co:50002',
  'electrum://electrum-bu-az-ausw.airbitz.co:50001',
  'electrums://electrum-bu-az-weuro.airbitz.co:50002',
  'electrum://electrum-bu-az-weuro.airbitz.co:50001',
  'electrum://electrum.hsmiths.com:8080',
  'electrum://e.anonyhost.org:50001',
  'electrum://ELECTRUM.not.fyi:50001',
  'electrum://electrum.zone:50001',
  'electrum://yui.kurophoto.com:50001',
  'electrums://yui.kurophoto.com:50002',
  'electrums://electrum.zone:50002',
  'electrum://abc1.hsmiths.com:60001',
  'electrum://electrum-ltc.festivaldelhumor.org:60001',
  'electrum://electrum-ltc.petrkr.net:60001',
  'electrum://electrum.dash.siampm.com:50001',
  'electrum://e-1.claudioboxx.com:50005',
  'electrum://electrum.leblancnet.us:50015'
]
// const SEED_SERVERS = [
//   'electrum://electrum-bc-az-eusa.airbitz.co:50001',
//   'electrum://electrum-bu-az-weuro.airbitz.co:50001',
//   'electrum://abc1.hsmiths.com:60001',
//   'electrum://electrum-ltc.festivaldelhumor.org:60001',
//   'electrum://electrum.dash.siampm.com:50001'
// ]

type CheckServersResponse = {
  [currencyCode: string]: Array<string>
}

export async function checkServers (serverList:Array<string>): Promise<CheckServersResponse> {
  let servers = SEED_SERVERS.concat(serverList)
  let startServers = servers.slice()
  let promiseArray = []

  //
  // Loop over all servers
  //
  for (let server of servers) {
    console.log(server)
    const p = getPeers(server)
    promiseArray.push(p)
  }

  let getPeersResults:Array<any> = await Promise.all(promiseArray)

  for (const result of getPeersResults) {
    // Each result is an array of peers or -1 if that server failed
    if (result.peers === -1) {
      _serverInfos[0].serverList.push(result.serverUrl)
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

  for (let svr of uniqueServers) {
    const p = checkServer(svr)
    promiseArray.push(p)
  }

  const results: Array<ServerResults | null> = await Promise.all(promiseArray)

  for (const result: ServerResults | null of results) {
    if (!result) {
      continue
    }
    const serverUrl = result.serverUrl
    const blockHeight = result.blockHeight

    let matchIdx = -1
    let coreIdx = -1
    for (let idx = 0; idx < _serverInfos.length; idx++) {
      // Hack to match Core server type
      if ('BC1' === _serverInfos[idx].currencyCode) {
        coreIdx = idx
      }
      if (result.currencyCode === _serverInfos[idx].currencyCode) {
        matchIdx = idx
      }
    }

    // Hack to match Core segwit server type
    if (result.currencyCode === 'BTC' &&
      _serverInfos[coreIdx].wantSegwit === result.hasSegwit &&
      _serverInfos[coreIdx].wantElectrumX === result.electrumx &&
      _serverInfos[coreIdx].wantV11 === result.v11
    ) {
      _serverInfos[coreIdx].serverList.push({serverUrl, blockHeight})
    }

    if (matchIdx < 0) {
      continue
    }

    if (_serverInfos[matchIdx].wantSegwit !== result.hasSegwit) {
      continue
    }

    if (_serverInfos[matchIdx].wantElectrumX && !result.electrumx) {
      continue
    }

    if (_serverInfos[matchIdx].wantV11 && !result.v11) {
      continue
    }

    _serverInfos[matchIdx].serverList.push({serverUrl, blockHeight})
  }

  const finalServers: CheckServersResponse = {}
  for (const serverInfo of _serverInfos) {
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
    if (heights[s] > highestScore) {
      highestScore = heights[s]
      heightWithHighestScore = parseInt(s)
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

function checkHeader500k (serverResults: ServerResults): QueryCommand {
  return {
    cmdString: '{ "id": __ID__, "method": "blockchain.block.get_header", "params": [ 500000 ] }\n',
    resultHandler: (resultObj: Object) => {
      if (
        typeof resultObj.result !== 'undefined' &&
        typeof resultObj.result.merkle_root !== 'undefined'
      ) {
        for (const serverInfo of _serverInfos) {
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
        for (const serverInfo of _serverInfos) {
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
          for (const s of _serverInfos) {
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
        console.log(err)
        resolved = true
        resolve(null)
      })

      client.on('close', () => {
        // console.log('Socket closed')
        resolved = true
        resolve(serverResults)
      })

      client.on('end', () => {
        // console.log('Socket end')
        resolved = true
        resolve(serverResults)
      })

      setTimeout(() => {
        if (!resolved) {
          client.destroy()
          // console.log('Socket timeout')
          resolve(null)
        }
      }, 10000)
    }
  })
}
