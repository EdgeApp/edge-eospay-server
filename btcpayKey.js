const btcpay = require('btcpay')
const keypair = btcpay.crypto.generate_keypair()
console.log('keypair: ', keypair)