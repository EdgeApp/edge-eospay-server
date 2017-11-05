/**
 * Created by paul on 9/8/17.
 */
/* global describe it */
const checkServers = require('../lib/checkServers.js').checkServers

const assert = require('assert')

describe('Check servers', function () {
  it('Has any good and bad servers', function (done) {
    this.timeout(120000)
    assert.doesNotThrow(() => {
      checkServers([]).then(servers => {
        assert.equal(servers.coreServers.length >= 0, true)
        assert.equal(servers.nonSegwitServers.length >= 0, true)
        assert.equal(servers.bchServers.length >= 0, true)
        assert.equal(servers.badServers.length >= 0, true)
        done()
      })
    })
  })
})
