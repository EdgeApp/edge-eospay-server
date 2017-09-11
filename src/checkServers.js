// @flow
// import fetch from 'node-fetch'
const fetch = require('node-fetch')

const net = require('net')
// const childProcess = require('child_process')

const CHECK_BLOCK_HEIGHT = '484253'
const CHECK_BLOCK_MERKLE = '378f5397b121e4828d8295f2496dcd093e4776b2214f2080782586a3cb4cd5c4'
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

  console.log('Found ' + uniqueServers.length + ' unique peers to check')

  promiseArray = []
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
      console.log(goodServers.length + 'GOOD SERVERS:\n')
      for (let s of goodServers) {
        console.log(s)
      }

      console.log('\n\n' + badServers.length + 'BAD SERVERS:\n')
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

function checkServer (height, serverUrl) {
  return new Promise((resolve) => {
    let regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    let results = regex.exec(serverUrl)
    const client = new net.Socket()
    let status:number = 0

    if (results === null) {
      resolve({useServer: false, serverUrl})
    } else {
      let resolved = false
      const port = results[2]
      const host = results[1]
      client.connect({ port, host }, () => {
        console.log('****** checkServer:' + serverUrl)
        let query = '{ "id": 1, "method": "blockchain.numblocks.subscribe", "params": [] }\n'
        client.write(query)
        console.log('query:' + query)

        query = '{ "id": 2, "method": "blockchain.block.get_header", "params": [' + CHECK_BLOCK_HEIGHT + '] }\n'
        client.write(query)
        console.log('query:' + query)

        query = '{ "id": 3, "method": "server.banner", "params": [] }\n'
        client.write(query)
        console.log('query:' + query)
      })

      let jsonData = ''

      client.on('data', (data) => {
        let results = data.toString('ascii')
        console.log(results)

        let resultObj = null

        try {
          resultObj = JSON.parse(jsonData + results)
        } catch (e) {
          jsonData += results
          return
        }

        let fail = true
        if (resultObj !== null) {
          if (resultObj.id === 1) {
            if (resultObj.result >= height - 1) {
              status++
              fail = false
            }
          } else if (resultObj.id === 2) {
            if (
              typeof resultObj.result !== 'undefined' &&
              typeof resultObj.result.merkle_root !== 'undefined' &&
              resultObj.result.merkle_root === CHECK_BLOCK_MERKLE) {
              status++
              fail = false
            }
          } else if (resultObj.id === 3) {
            if (typeof resultObj.result !== 'undefined') {
              if (resultObj.result.toLowerCase().includes('electrumx')) {
                status++
                fail = false
              }
            }
          }
          if (status === 3) {
            console.log('checkServer SUCCESS:' + serverUrl)
            resolved = true
            client.write('Goodbye!!!')
            client.destroy()
            resolve({useServer: true, serverUrl})
          }
        }

        if (fail) {
          console.log('checkServer FAIL:')
          console.log('checkServer FAIL:' + serverUrl)
          console.log(resultObj)
          client.write('Goodbye!!!')
          resolved = true
          resolve({useServer: false, serverUrl})
        }
      })

      client.on('error', (err) => {
        console.log(err)
        resolved = true
        resolve({useServer: false, serverUrl})
      })

      client.on('close', () => {
        console.log('Socket closed')
        resolved = true
        resolve({useServer: false, serverUrl})
      })

      client.on('end', () => {
        console.log('Socket end')
        resolved = true
        resolve({useServer: false, serverUrl})
      })

      setTimeout(() => {
        if (!resolved) {
          client.destroy()
          console.log('Socket timeout')
          resolve({useServer: false, serverUrl})
        }
      }, 10000)
    }
  })
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
