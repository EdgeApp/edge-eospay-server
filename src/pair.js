const buffer = require('buffer')
const btcpay = require('btcpay')

const keypair = btcpay.crypto.load_keypair(new Buffer.from('6211566414174247285524073942879897560007699745487275136820047398038480939666', 'hex'))

const client = new btcpay.BTCPayClient('https://btcpay135208.lndyn.com', keypair, {merchant: "Cx28rZLwVLkUWpUvr3fyq1kkig8R5UKPhuSBweELNbbk"});

console.log('client: ', client)

client.get_invoices()
.then(async (btcPayInvoices) => {
  console.log('btcPayInvoices: ', btcPayInvoices)
})