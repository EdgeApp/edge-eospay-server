const eosjs = require('eosjs')
const eos = eosjs({
  "chainId": "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
  "httpEndpoint": "https://api.eosnewyork.io/v1",
  "expireInSeconds": 60,
  "broadcast": true,
  "debug": false,
  "sign": true
})

eos.getKeyAccounts('EOS7YiNwHCeJdqXbFwdMfpib8SQk2HooMMmCacAzN8LEPzMNLetnP', (error, result) => {
  if (error) {
    console.log('error: ', error)
    reject(error)
  } else {
    console.log('result: ', result)
    resolve(result)
  }
})