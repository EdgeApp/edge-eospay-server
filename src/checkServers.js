// @flow
// import fetch from 'node-fetch'
const fetch = require('node-fetch')
const sprintf = require('sprintf-js').sprintf

const net = require('net')
// const childProcess = require('child_process')

const CHECK_BLOCK_HEIGHT = '484253'
const CHECK_BLOCK_MERKLE = '378f5397b121e4828d8295f2496dcd093e4776b2214f2080782586a3cb4cd5c4'

const CHECK_SEGWIT_TX_ID = 'ef298148f25162db85127b83daefe07e46b06078f95aa30969b007a09a722b61'
// const CHECK_SEGWIT_TX_RAW = '0100000002f8a7d578817bb42636a2552de53db822f30d776133ec3d1b9c58f435342e50ad000000002322002096c365c331033867275b5b693000e7396baa02cbeca80d605356c5acf3d9b0deffffffffe023a2e5ee2b63957e8e40a5a1ef3cf21f0de201af0da674d19e35a415394407000000002322002015e61ade874e81c9efcdb6739be8b67332c190554759cc5e144937f6974b7a77ffffffff02060e0600000000001976a91440f857348a9e1282b6455d83db110ae204b7268388acc06998000000000017a914395cc0ef446992db0694a8ee6a52274bab0a4c8c8700000000'
const CHECK_SEGWIT_TX_RAW = '0100000002f8a7d578817bb4'

// 0100000002f8a7d578817bb42636a2552de53db822f30d776133ec3d1b9c58f435342e50ad000000002322002096c365c331033867275b5b693000e7396baa02cbeca80d605356c5acf3d9b0deffffffffe023a2e5ee2b63957e8e40a5a1ef3cf21f0de201af0da674d19e35a415394407000000002322002015e61ade874e81c9efcdb6739be8b67332c190554759cc5e144937f6974b7a77ffffffff02060e0600000000001976a91440f857348a9e1282b6455d83db110ae204b7268388acc06998000000000017a914395cc0ef446992db0694a8ee6a52274bab0a4c8c8700000000
// 01000000000102f8a7d578817bb42636a2552de53db822f30d776133ec3d1b9c58f435342e50ad000000002322002096c365c331033867275b5b693000e7396baa02cbeca80d605356c5acf3d9b0deffffffffe023a2e5ee2b63957e8e40a5a1ef3cf21f0de201af0da674d19e35a415394407000000002322002015e61ade874e81c9efcdb6739be8b67332c190554759cc5e144937f6974b7a77ffffffff02060e0600000000001976a91440f857348a9e1282b6455d83db110ae204b7268388acc06998000000000017a914395cc0ef446992db0694a8ee6a52274bab0a4c8c87040047304402207ed7de08fcd309a88a27d9d0c6fbce10b402f3bf3111137a607b1b4fb110b0de0220348a5e653020885c4dcbd054e348daf53fdd2d2282db05bee822d8dbc5390bff01483045022100f3ae6b2368355c6041c44081caf51828e420d8afd7b0d3d486ed722c2eae5ef2022021e5c66709a1f3c1e8a7ff41d23d9b0e1da9e2b1bd9f832da9df631b6af78ca6016952210204888c56fd54f254c5e991c60131e3efc8db0ed7051a2232b3d4d24143b6f2f02103022fc4c408d08902134880a4958f6b3c9207026586683c609f9635c03e46a379210310d3885dbb09a93b7bdb12aa9757579539b746fc080c3397c2bb1e688cea438053ae04004730440220733792dc3ad7613db14bb960ab6b918702aa8178986e5be90024f0a6d97e373602205b7a5767d524d6e8415caaaea6b24a9c3e2ad09f4dd2b6ac5775d392b53c580e0147304402205775814f3de90c0ca18737d3f2d9fdf52f9af4d8fdf66dd9e2355c68e490bb600220302b00399fe75650bf89bb68c24a39c804dd7aa449490d3486aceaca4b0d008e0169522102af82a350b7d485c20bb9e6b4ab93ad1138413981c364887e8ba9ce1f27c9b75e21036da1cdf952bb54ff5a4d02df4008a161ad6047193447fdd5a7176e12bc71fa49210225f085f9dc41d41
// 01000000000102f8a7d578817bb42636a2552de53d

console.log(CHECK_SEGWIT_TX_ID)
console.log(CHECK_SEGWIT_TX_RAW)
const SEED_SERVERS = [
  'electrum://electrum.jdubya.info:50001',
  'electrum://electrum-bc-az-eusa.airbitz.co:50001',
  'electrum://electrum-bu-az-wusa2.airbitz.co:50001',
  'electrum://electrum-bu-az-wjapan.airbitz.co:50001',
  'electrum://electrum-bu-az-ausw.airbitz.co:50001',
  'electrum://electrum.hsmiths.com:8080',
  'electrum://electrum-bu-az-weuro.airbitz.co:50001',
  'electrum://e.anonyhost.org:50001',
  'electrum://ELECTRUM.not.fyi:50001'
]

const goodServers = []
const badServers = []

function dateString () {
  const date = new Date()
  return date.toDateString() + ':' + date.toTimeString()
}

async function fetchGet (url:string) {
  const response = await fetch(url, {
    method: 'GET'
  })
  return response.json()
}

export async function checkServers (serverList:Array<string>) {
  let currentHeight
  try {
    const data = await fetchGet('https://blockchain.info/latestblock')
    currentHeight = data.height
  } catch (e) {
    console.log(e)
    return
  }

  let servers = SEED_SERVERS.concat(serverList)
  let finalServers = servers.slice()
  let promiseArray = []

  //
  // Loop over all servers
  //

  for (let server of servers) {
    console.log(server)
    const p = getPeers(server)
    promiseArray.push(p)
  }

  let results:Array<any> = await Promise.all(promiseArray)

  for (const result of results) {
    // Each result is an array of peers or -1 if that server failed
    if (result.peers === -1) {
      badServers.push(result.serverUrl)
    } else {
      finalServers = finalServers.concat(result.peers)
    }
  }

  let uniqueServers = Array.from(new Set(finalServers))
  // let uniqueServers = SEED_SERVERS

  console.log('Found ' + uniqueServers.length + ' unique peers to check')

  promiseArray = []
  // uniqueServers = ['electrum://electrum-bu-az-wjapan.airbitz.co:50001', 'electrum://electrum-bu-az-weuro.airbitz.co:50001']
  for (let svr of uniqueServers) {
    const p = checkServer(currentHeight, svr)
    promiseArray.push(p)
  }

  results = await Promise.all(promiseArray)

  for (const result of results) {
    const { useServer, serverUrl } = result
    if (useServer === true) {
      goodServers.push(serverUrl)
      console.log('good server: [' + serverUrl + ']')
    } else {
      badServers.push(serverUrl)
      console.log('bad server: [' + serverUrl + ']')
    }
    console.log('numGood:' + goodServers.length + ' numBad:' + badServers.length)
    if (goodServers.length + badServers.length === uniqueServers.length) {
      console.log(goodServers.length + ' GOOD SERVERS:\n')
      for (let s of goodServers) {
        console.log(s)
      }

      console.log('\n\n' + badServers.length + ' BAD SERVERS:\n')
      for (let s of badServers) {
        console.log(s)
      }

      // Send updated server list to Django auth server. Server must be running on
      // Local machine as we will do direct python 'manage.py' calls to update the server. There is
      // no API to do updates.
      // updateAuthServerDjango(goodServers, badServers)
      return { goodServers, badServers }
    }
  }
}

const ID_HEIGHT = 1
const ID_HEADER = 2
const ID_BANNER = 3
const ID_SEGWIT = 4

function checkServer (height, serverUrl) {
  return new Promise((resolve) => {
    let regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    let results = regex.exec(serverUrl)
    const client = new net.Socket()

    const checks = [false, false, false, false, false, false, false, false]
    const NUM_CHECKS = 4

    if (results === null) {
      resolve({useServer: false, serverUrl})
    } else {
      let resolved = false
      const port = results[2]
      const host = results[1]
      client.connect({ port, host }, () => {
        console.log('****** checkServer:' + serverUrl)
        let query = sprintf('{ "id": %d, "method": "blockchain.numblocks.subscribe", "params": [] }\n', ID_HEIGHT)
        client.write(query)
        console.log('query:' + query)

        query = sprintf('{ "id": %d, "method": "blockchain.block.get_header", "params": [' + CHECK_BLOCK_HEIGHT + '] }\n', ID_HEADER)
        client.write(query)
        console.log('query:' + query)

        query = sprintf('{ "id": %d, "method": "server.banner", "params": [] }\n', ID_BANNER)
        client.write(query)
        console.log('query:' + query)

        query = sprintf('{ "id": %d, "method": "blockchain.transaction.get", "params": ["' + CHECK_SEGWIT_TX_ID + '"] }\n', ID_SEGWIT)
        client.write(query)
        console.log('query:' + query)
      })

      let jsonData = ''

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

        for (const result of arrayResults) {
          const { responseId, success } = processResponse(result, height)
          if (resolved) {
            return
          }
          if (success) {
            checks[responseId] = true
          } else {
            console.log('checkServer FAIL:' + serverUrl)
            console.log(result)
            client.write('Goodbye!!!')
            resolved = true
            resolve({useServer: false, serverUrl})
          }

          let complete = true
          for (let c = 1; c <= NUM_CHECKS; c++) {
            if (checks[c] === false) {
              complete = false
              break
            }
          }
          if (complete) {
            console.log('checkServer SUCCESS:' + serverUrl)
            resolved = true
            client.write('Goodbye!!!')
            client.destroy()
            resolve({useServer: true, serverUrl})
          }
        }
      })

      client.on('error', (err) => {
        console.log(err)
        resolved = true
        resolve({useServer: false, serverUrl})
      })

      client.on('close', () => {
        // console.log('Socket closed')
        resolved = true
        resolve({useServer: false, serverUrl})
      })

      client.on('end', () => {
        // console.log('Socket end')
        resolved = true
        resolve({useServer: false, serverUrl})
      })

      setTimeout(() => {
        if (!resolved) {
          client.destroy()
          // console.log('Socket timeout')
          resolve({useServer: false, serverUrl})
        }
      }, 10000)
    }
  })
}

function processResponse (resultObj, height) {
  console.log('processResponse START')
  let fail = true
  let responseId = 0
  if (resultObj !== null) {
    responseId = resultObj.id
    if (responseId === ID_HEIGHT) {
      if (resultObj.result >= height - 1) {
        fail = false
      } else {
        console.log('processResponse FAIL height')
      }
      // } else if (resultObj.method === 'blockchain.numblocks.subscribe') {
      //   responseId = 1
      //   if (resultObj.params[0] >= height - 1) {
      //     fail = false
      //   }
    } else if (responseId === ID_HEADER) {
      if (
        typeof resultObj.result !== 'undefined' &&
        typeof resultObj.result.merkle_root !== 'undefined' &&
        resultObj.result.merkle_root === CHECK_BLOCK_MERKLE) {
        fail = false
      } else {
        console.log('processResponse FAIL bitcoincash merkle')
      }
    } else if (responseId === ID_BANNER) {
      if (typeof resultObj.result !== 'undefined') {
        if (resultObj.result.toLowerCase().includes('electrumx')) {
          fail = false
        } else {
          console.log('processResponse FAIL electrumx')
        }
      } else {
        console.log('processResponse FAIL result electrumx')
      }
    } else if (resultObj.id === ID_SEGWIT) {
      if (typeof resultObj.result !== 'undefined') {
        if (resultObj.result.toLowerCase().includes(CHECK_SEGWIT_TX_RAW)) {
          fail = false
        } else {
          console.log('processResponse FAIL segwit')
        }
      } else {
        console.log('processResponse FAIL result segwit')
      }
    } else if (resultObj.method === 'blockchain.numblocks.subscribe') {
      if (resultObj.params[0] >= height - 1) {
        fail = false
        responseId = ID_HEIGHT
      } else {
        console.log('processResponse FAIL method height')
      }
    } else {
      console.log('processResponse FAIL processid')
    }
    // if (status === 4) {
  } else {
    console.log('processResponse FAIL resultObj')
  }

  const out = {
    responseId,
    success: !fail
  }
  console.log(out)
  if (fail) {
    console.log(resultObj)
  }
  return out
}

function getPeers (_serverUrl) {
  const serverUrl = _serverUrl
  return new Promise((resolve) => {
    console.log('*********** getPeers: ' + serverUrl)
    let regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    let results = regex.exec(serverUrl)
    let resolved = false
    const client = new net.Socket()

    if (results !== null) {
      const port = results[2]
      const host = results[1]
      client.connect({ port, host }, () => {
        console.log('connect')
        const query = '{ "id": 2, "method": "server.peers.subscribe", "params": [] }\n'
        client.write(query)
        console.log('query:' + query + '***')
      })
    } else {
      resolve({serverUrl, peers: -1})
    }
    let peers = []

    let jsonData = ''

    client.on('data', (data) => {
      let results = data.toString('ascii')
      console.log(results)
      let resultObj
      try {
        resultObj = JSON.parse(jsonData + results)
      } catch (e) {
        jsonData += results
        return
      }

      if (resultObj !== null) {
        let rArray = resultObj.result
        for (let serverObj of rArray) {
          let serverName = serverObj[1]
          let port = 50001
          let numTxHistory = 10000

          for (const deet of serverObj[2]) {
            if (deet.startsWith('p')) {
              let regex = new RegExp(/p(.*)/)
              let results = regex.exec(deet)
              if (results !== null) {
                numTxHistory = results[1]
              }
            }
            if (deet.startsWith('t')) {
              let regex = new RegExp(/t(.*)/)
              let results = regex.exec(deet)
              if (results !== null) {
                port = results[1]
              }
            }
          }

          if (numTxHistory < 1000) {
            // Exit
            console.log(serverName + ': Insufficient numTxHistory:' + numTxHistory)
            continue
          }

          let url = 'electrum://' + serverName + ':' + port
          console.log('Add peer: ' + url + ' from:' + serverUrl)
          peers.push(url)
        }
      }
      console.log(dateString())
      console.log('-------------- FINISHED getPeers: ' + serverUrl)
      client.write('Goodbye!!!')
      client.destroy()
      resolved = true
      resolve({serverUrl, peers})
    })

    client.on('error', function (err) {
      console.log(dateString())
      console.log('-------------- ERROR getPeers:' + serverUrl)
      console.log(err)
      resolved = true
      resolve({serverUrl, peers: -1})
    })

    client.on('close', function () {
      console.log(dateString())
      console.log('CLOSE getPeers:' + serverUrl)
    })

    setTimeout(() => {
      if (!resolved) {
        client.write('Goodbye!!!')
        client.destroy()
        console.log(dateString())
        console.log('TIMEOUT getPeers:' + serverUrl)
        resolve({serverUrl, peers: -1})
      }
    }, 10000)
  })
}
