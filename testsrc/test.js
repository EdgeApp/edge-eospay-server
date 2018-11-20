/**
 * Created by paul on 9/8/17.
 */
/* global describe it */
const { checkServers } = require('../lib/checkServers.js')
const serverInfos = require('../testJson/serverInfos.json')
const seedServers = require('../testJson/seedServers.json')

const assert = require('assert')

describe('Check servers', function () {
  it('Has any good and bad servers', function (done) {
    this.timeout(1000000)
    assert.doesNotThrow(() => {
      checkServers(seedServers.servers, serverInfos).then(servers => {
        assert.equal(!!servers.BC1, true)
        assert.equal(!!servers.BCH, true)
        assert.equal(!!servers.LTC, true)
        assert.equal(!!servers.DASH, true)
        assert.equal(servers.BC1.length >= 1, true)
        assert.equal(servers.BCH.length >= 1, true)
        assert.equal(servers.LTC.length >= 1, true)
        assert.equal(servers.DASH.length >= 1, true)
        done()
      })
    })
  })
})
