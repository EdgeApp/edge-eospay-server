/**
 * Created by paul on 9/8/17.
 */
/* global describe it */
const checkServers = require('../lib/checkServers.js').checkServers

const assert = require('assert')

describe('Check servers', function () {
  it('Has any good and bad servers', function (done) {
    assert.doesNotThrow(() => {
      checkServers([]).then(servers => {
        assert.equal(servers.goodServers.length > 0, true)
        assert.equal(servers.badServers.length > 0, true)
        done()
      })
    })
  })
})
