/**
 * Created by paul on 9/8/17.
 */
/* global describe it */
const { checkServers } = require('../lib/checkServers.js')

const assert = require('assert')

describe('Check servers', function () {
  it('Has any good and bad servers', function (done) {
    this.timeout(120000)
    assert.doesNotThrow(() => {
      checkServers([]).then(servers => {
        assert.equal(servers.BTC.length >= 1, true)
        assert.equal(servers.BC1.length >= 1, true)
        assert.equal(servers.BCH.length >= 1, true)
        assert.equal(servers.LTC.length >= 1, true)
        assert.equal(servers.DASH.length >= 1, true)
        done()
      })
    })
  })
})
