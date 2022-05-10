const buffer = require('buffer')
const btcpay = require('btcpay')

const keypair = btcpay.crypto.load_keypair(new Buffer.from('', 'hex'))

const client = new btcpay.BTCPayClient('https://btcpay338063.lndyn.com', keypair, {merchant: ""});

console.log('client: ', client)

client.get_invoices()
.then(async (btcPayInvoices) => {
  console.log('btcPayInvoices: ', btcPayInvoices)
})

// # Replace the BTCPAY_XXX envirnoment variables with your values and run:

// $ [space] BTCPAY_URL=https://btcpay338063.lndyn.com BTCPAY_KEY="1f3ad04df972593d8de26a33faf852361bc097ecc5471b0e057868fa04fb3595" BTCPAY_PAIRCODE=vb7jFri node -e "const btcpay=require('btcpay'); new btcpay.BTCPayClient(process.env.BTCPAY_URL, btcpay.crypto.load_keypair(Buffer.from(process.env.BTCPAY_KEY, 'hex'))).pair_client(process.env.BTCPAY_PAIRCODE).then(console.log).catch(console.error)"

// # (prepend the line with a space to prevent BTCPAY_KEY from being saved to your bash history)

// >>> { merchant: 'XXXXXX' }