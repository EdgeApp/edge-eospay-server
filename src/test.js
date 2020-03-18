////////////////////////////////////////////
// BTC Pay server
////////////////////////////////////////////
const buffer = require('buffer')
const btcpay = require('btcpay')

const keypair = btcpay.crypto.load_keypair(new Buffer.from('1f3ad04df972593d8de26a33faf852361bc097ecc5471b0e057868fa04fb3595', 'hex'))

// console.log('keypair: ', keypair)
const client = new btcpay.BTCPayClient('https://btcpay.teloscrew.com', keypair, {merchant: "8iDFCwi2XUCTXBmFsKcCvKNXfTm5R2ozhDaYgRefZFpP"});
console.log(3)
// store id on btcpay
client.get_rates(['BTC_USD'], 'AH2V3cFTyrjNxrMa8PBt7CVqGTpCG6SrxihsePNVibWT')
  .then(rates => console.log(rates))
  .catch(err => console.log(err));