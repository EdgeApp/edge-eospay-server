// @flow
import fetch from 'node-fetch'

const net = require('net')
// const childProcess = require('child_process')

const goodServers = []
const badServers = []
const seedServers = [
  'electrum://stratum-ramnode-nl.airbitz.co:80',
  'electrum://stratum-az-neuro.airbitz.co:50001',
  'electrum://stratum-az-wjapan.airbitz.co:50001',
  'electrum://stratum-az-wusa.airbitz.co:50001',
  'electrum://electrum.jdubya.info:50001',
  'electrum://electrum.hsmiths.com:8080'
]

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

  let servers = seedServers.concat(serverList)
  let finalServers = servers.slice()

  //
  // Loop over all servers from auth.airbitz.co and get their list of electrum peers
  //

  for (let server of serverList) {
    let peers = []
    try {
      peers = await getPeers(server)
    } catch (e) {
      console.log(e)
    }
    finalServers = finalServers.concat(peers)
  }

  let uniqueServers = Array.from(new Set(finalServers))

  for (let svr of uniqueServers) {
    const { useServer, serverUrl } = await checkServer(currentHeight, svr)
    if (useServer === true) {
      goodServers.push(serverUrl)
      console.log('good server: ' + serverUrl)
    } else {
      badServers.push(serverUrl)
      console.log('bad server: ' + serverUrl)
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
  return new Promise((resolve, reject) => {
    let regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    let results = regex.exec(serverUrl)
    const client = new net.Socket()

    if (results === null) {
      resolve({useServer: false, serverUrl})
    } else {
      const port = results[2]
      const host = results[1]
      client.connect({ port, host }, () => {
        console.log('connecting to:' + serverUrl)
        let query = '{ "id": 1, "method": "blockchain.numblocks.subscribe", "params": [] }\n'
        client.write(query)
        console.log('query:' + query + '***')
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

        if (resultObj !== null) {
          if (resultObj.result >= height - 1) {
            client.write('Goodbye!!!')
            resolve({useServer: true, serverUrl})
          }
        }
        client.write('Goodbye!!!')
        resolve({useServer: false, serverUrl})
      })

      client.on('error', (err) => {
        console.log(err)
        resolve({useServer: false, serverUrl})
      })

      client.on('close', () => {
        console.log('Socket closed')
        resolve({useServer: false, serverUrl})
      })

      client.on('end', () => {
        console.log('Socket end')
        resolve({useServer: false, serverUrl})
      })
    }
  })
}

function getPeers (serverUrl) {
  return new Promise((resolve, reject) => {
    let regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    let results = regex.exec(serverUrl)
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
      reject(new Error('Invalid server url: ' + serverUrl))
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
          let detailsArray = serverObj[2]
          let connections = detailsArray[1]
          let port = detailsArray[2]
          let numConnections = 0

          let connRegex = new RegExp(/p(.*)/)
          let connRegexResults = connRegex.exec(connections)

          if (connRegexResults !== null) {
            numConnections = connRegexResults[1]
          }

          if (numConnections < 1000) {
            // Exit
            console.log(serverName + ': Insufficient numConnections:' + numConnections)
            continue
          }

          if (port === 't') {
            port = 50001
          } else {
            let regex2 = new RegExp(/t(.*)/)
            let results2 = regex2.exec(port)

            if (results2 !== null) {
              port = results2[1]
            } else {
              console.log(serverName + ': Wrong port support')
              continue
            }
          }
          let serverUrl = 'electrum://' + serverName + ':' + port
          console.log(serverUrl)
          peers.push(serverUrl)
        }
      }
      client.write('Goodbye!!!')
      resolve(peers)
    })

    client.on('error', function (err) {
      console.log(err)
      reject(new Error('Connection error:' + serverUrl))
    })

    client.on('close', function () {
      console.log('close')
    })
  })
}

// ===============================================================

// //
// // Get the block height as reported by blockchain.info
// //
// restClient.get('https://blockchain.info/latestblock', function (data, response) {
//   let currentHeight = data.height
//
//   //
//   // Get the current list of seed servers from auth.airbitz.co
//   // API key used is from user 'check_server' 004c58827a788775e1f06ee5afbcfbb1cab57344
//   //
//   let args = {
//     data: { test: '' },
//     headers: {
//       'Content-Type': 'application/json',
//       // 'Authorization': 'Token ' + '7783588500df950fe1b04b39c7deec4d880de9ec'}
//       'Authorization': 'Token ' + '004c58827a788775e1f06ee5afbcfbb1cab57344'}
//   }
//
//   restClient.post('https://auth.airbitz.co/api/v1/getinfo', args, function (data2, response2) {
//     if (data2.status_code === 0) {
//       // Success
// //xxxxxxx
//
//     }
//   })
// })
//
// String.format = function (format) {
//   let args = Array.prototype.slice.call(arguments, 1)
//   return format.replace(/{(\d+)}/g, function (match, number) {
//     return typeof args[number] !== 'undefined'
//       ? args[number]
//       : match
//   })
// }
//
// function updateAuthServerDjango (goodServers, badServers) {
//   let initServerCmd =
//     'from django.contrib.auth.models import User\n' +
//     'from restapi.models import ObeliskServers\n'
//   let addServerCmd =
//     '(new_server{1}, _) = ObeliskServers.objects.get_or_create(uri=\'{0}\')\n' +
//     'new_server{1}.users = User.objects.all()\n'
//   let removeServerCmd =
//     'ObeliskServers.objects.filter(uri=\'{0}\').delete()\n'
//
//   let addRemoveServerCmd = initServerCmd
//   for (let i in goodServers) {
//     addRemoveServerCmd = addRemoveServerCmd + String.format(addServerCmd, goodServers[i], i)
//   }
//   for (let i in badServers) {
//     addRemoveServerCmd = addRemoveServerCmd + String.format(removeServerCmd, badServers[i])
//   }
//
//   console.log('Django cmd="' + addRemoveServerCmd + '"')
//
//   childProcess.spawnSync('/bin/bash', ['managepy.sh'], {input: addRemoveServerCmd})
// }

// function checkServer (height, serverUrl, callback) {
//   let regex = new RegExp(/stratum:\/\/(.*):(.*)/)
//   let results = regex.exec(serverUrl)
//
//   if (results === null) {
//     let regex2 = new RegExp(/tcp:\/\/(.*):(.*)/)
//     let results2 = regex2.exec(serverUrl)
//
//     if (results2 === null) {
//       callback(null, false, serverUrl)
//     } else {
//       callback(null, true, serverUrl)
//     }
//   } else {
//     let port = results[2]
//     let serverName = results[1]
//
//     let client = NetcatClient(port, serverName)
//     let jsonData = ''
//
//     client.on('open', function () {
//       console.log('connecting to: ' + serverUrl)
//       let query = '{ "id": 1, "method": "blockchain.numblocks.subscribe", "params": [] }\n'
//       client.send(query)
//     })
//
//     client.on('data', function (data) {
//       let results = data.toString('ascii')
//       console.log(results)
//
//       let resultObj = null
//
//       try {
//         resultObj = JSON.parse(jsonData + results)
//       } catch (e) {
//         jsonData += results
//         return
//       }
//
//       if (resultObj != null) {
//         if (resultObj.result >= height - 1) {
//           client.send('Goodbye!!!', true)
//           callback(null, true, serverUrl)
//           return
//         }
//       }
//       client.send('Goodbye!!!', true)
//       callback(null, false, serverUrl)
//     })
//
//     client.on('error', function (err) {
//       console.log(err)
//       callback(null, false, serverUrl)
//     })
//
//     client.on('close', function () {
//       console.log('close')
//     })
//
//     client.start()
//   }
// }
