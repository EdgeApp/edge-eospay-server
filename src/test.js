////////////////////////////////////////////
// BTC Pay server
////////////////////////////////////////////
const buffer = require('buffer')
const btcpay = require('btcpay')

const keypair = btcpay.crypto.load_keypair(new Buffer.from('1f3ad04df972593d8de26a33faf852361bc097ecc5471b0e057868fa04fb3595', 'hex'))

const client = new btcpay.BTCPayClient('https://btcpay.teloscrew.com', keypair, {merchant: "6wEpWvJkAzump9cibtW6uw3knqrHyqCjk88f7btw7rAs"});
// store id on btcpay

const params = {
  dateStart: '2020-01-01',
  dateEnd: '2020-03-24',
  limit: 50,
  offset: 0
}
// client.get_invoices({
//   params,
//   token: '6wEpWvJkAzump9cibtW6uw3knqrHyqCjk88f7btw7rAs'
// })
client.get_invoices()
  .then(rates => console.log(JSON.stringify(rates)))
  .catch(err => console.log(err));