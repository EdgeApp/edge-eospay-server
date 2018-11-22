
const fs = require('fs')
const btcpay = require('btcpay')
const keypair = btcpay.crypto.generate_keypair()
const bitauth = require('bitauth')
const https = require('https')
// const querystring = require('querystring')

console.log(keypair.priv, keypair.pub);
// const data = new Uint8Array(Buffer.from('EXPORT BTCPAY_CLIENT_PRIVATEKEY=' + keypair.priv + '\n'
//  +'EXPORT BTCPAY_CLIENT_PUBKEY=' + keypair.pub));
// fs.writeFile('.envconfig', data, (err) => {
//   if (err) throw err;
//   console.log('The file has been saved!');
// });

// const client = new btcpay.BTCPayClient('https://btcpay.cryptosystemsadvisor.com', keypair)
// const sin = bitauth.generateSin()

// console.log("SIN",sin)

const postData = JSON.stringify({
	'id': 'Tf2mQn6vX3B3KuiRkLE8YqZj1W8pPntYyMX',
	'label' : 'EOS Name Payment API',
	'facade': 'merchant'
})

const options = {
  port: 443,
  hostname: 'btcpay.cryptosystemsadvisor.com',
  method: 'POST',
  path: '/tokens',
  headers : {
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
    'Cache-Control' : 'no-cache'
  }
}

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`)
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`)
  })
  res.on('end', () => {
    console.log('No more data in response.')
  })
  
})

req.on('error', (e) => {
  console.log(`problem with request: ${e.message}`);
});

// write data to request body
req.write(postData);

console.log("REQUEST OBJECT HEADERS: " , req.getHeaders());
// console.log("REQUEST OBJECT BODY: " , req.);

req.end();


console.log("---------------------------------------------------------------------");