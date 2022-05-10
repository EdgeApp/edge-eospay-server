// @flow

const net = require('net')
const tls = require('tls')

// function dateString () {
//   const date = new Date()
//   return date.toDateString() + ':' + date.toTimeString()
// }

function getPeers (_serverUrl: string): Promise<Object> {
  const serverUrl = _serverUrl
  return new Promise((resolve: Function, reject: Function): void => {
    // let regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    let regex
    let ssl = false
    if (typeof serverUrl !== 'string') {
      resolve({serverUrl, peers: -1})
    }
    if (serverUrl.startsWith('electrums:')) {
      regex = new RegExp(/electrums:\/\/(.*):(.*)/)
      ssl = true
    } else {
      regex = new RegExp(/electrum:\/\/(.*):(.*)/)
    }
    let results = regex.exec(serverUrl)
    let resolved = false
    let client

    if (results !== null) {
      const port = results[2]
      const host = results[1]
      let tcp
      if (ssl) {
        tcp = tls
      } else {
        tcp = net
      }
      client = tcp.connect({ port, host, rejectUnauthorized: false }, () => {
        // console.log('connect')
        const query = '{ "id": 2, "method": "server.peers.subscribe", "params": [] }\n'
        client.write(query)
        // console.log('query:' + query + '***')
      })
    } else {
      resolve({serverUrl, peers: -1})
      return
    }
    let peers = []

    let jsonData = ''

    client.on('data', (data) => {
      let results = data.toString('ascii')
      // console.log(results)
      let resultObj
      try {
        resultObj = JSON.parse(jsonData + results)
      } catch (e) {
        jsonData += results
        return
      }

      if (resultObj !== null && resultObj.result) {
        let rArray = resultObj.result
        for (let serverObj of rArray) {
          let serverName = serverObj[1]
          let port = 50001
          let sport = 0
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
            if (deet.startsWith('s')) {
              let regex = new RegExp(/s(.*)/)
              let results = regex.exec(deet)
              if (results !== null) {
                sport = results[1]
              }
            }
          }

          if (numTxHistory < 1000) {
            // Exit
            // console.log(serverName + ': Insufficient numTxHistory:' + numTxHistory)
            continue
          }

          if (parseInt(sport) > 0) {
            // const url = 'electrums://' + serverName + ':' + sport
            // console.log('Add peer: ' + url + ' from:' + serverUrl)
            // peers.push(url)
          }
          if (parseInt(port) > 0) {
            const url = 'electrum://' + serverName + ':' + port
            // console.log('Add peer: ' + url + ' from:' + serverUrl)
            peers.push(url)
          }
        }
      }
      // console.log(dateString())
      // console.log('-------------- FINISHED getPeers: ' + serverUrl)
      client.write('Goodbye!!!')
      client.destroy()
      resolved = true
      resolve({serverUrl, peers})
    })

    client.on('error', function (error) {
      // const e = err.code ? err.code : ''
      // console.log(dateString())
      // console.log('getPeers:' + serverUrl + ' ERROR:' + e)
      resolved = true
      resolve({serverUrl, peers: -1, error})
    })

    client.on('close', function () {
      // console.log(dateString())
      // console.log('CLOSE getPeers:' + serverUrl)
      resolved = true
      resolve({serverUrl, peers: -1})
    })

    setTimeout(() => {
      if (!resolved) {
        client.write('Goodbye!!!')
        client.destroy()
        // console.log(dateString())
        // console.log('TIMEOUT getPeers:' + serverUrl)
        resolve({serverUrl, peers: -1})
      }
    }, 10000)
  })
}

module.exports = { getPeers }
