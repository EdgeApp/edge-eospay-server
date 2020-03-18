const fetch = require("isomorphic-fetch")

const { JsonRpc } = require("@eoscafe/hyperion")
const endpoint = "http://api.eossweden.org"
const hyperionRpc = new JsonRpc(endpoint, { fetch })

async function main () {
  try {
    const response = await hyperionRpc.get_tokens('haytemrtg4ge')
    console.log('response is: ', response)
    // const result = await response.json()
    // console.log('result: ', result)
  } catch (e) {
    console.log('error: ', e)
  }
}

main()