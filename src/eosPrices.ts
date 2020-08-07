// @flow

const fetch = require('node-fetch')
const { bns } = require('biggystring')
const fs = require('fs')
const CONFIG = require('../config/serverConfig.js')

const eosPricesFile = './cache/eosPrices.json'

const eosPrices = async (chain) => {
  const uccc = chain.toUpperCase() // uppercase currencyCode
  const hyperionEndpoint = CONFIG.chains[chain].hyperionEndpoint
  let options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      scope: 'eosio',
      code: 'eosio',
      table: 'rammarket',
      json: true
    })
  }
  const out = {}
  try {

    const url = `${hyperionEndpoint}/v1/chain/get_table_rows`
    const result = await fetch(url, options)
    const resultJson = await result.json()
    const ramInfo = resultJson.rows[0]
    const quote = ramInfo.quote.balance.replace(` ${uccc}`, '')
    const base = ramInfo.base.balance.replace(` RAM`, '')
    const ramPerByte = bns.div(quote, base, 8)
    const ram = bns.mul(ramPerByte, '1000')
    // output is amount of CHAIN CURRENCY per Byte
    out.ram = ram
  } catch (e) {
    console.log(e)
  }

  options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ account_name: 'eosnewyorkio' })
  }
  try {
    const url = `${hyperionEndpoint}/v1/chain/get_account`
    const result = await fetch(url, options)
    const account = await result.json()
    const net = calcNet(account, uccc)
    const cpu = calcCpu(account)

    out.net = net
    out.cpu = cpu
  } catch (e) {
    console.log(e)
  }
  return out
}

function calcNet (account, uccc) {
  if (!account.total_resources) {
    throw new Error('[total_resources] is missing in account')
  }
  if (!account.net_limit) {
    throw new Error('[net_limit] is missing in account')
  }
  const { total_resources: totalResources, net_limit: netLimit } = account
  const netWeight = totalResources.net_weight.replace(` ${uccc}`, '')
  let price = bns.div(netWeight, netLimit.max.toString(), 16)
  price = bns.mul(price, '1024')
  price = bns.div(price, '3', 16)
  return price
}

function calcCpu (account) {
  if (!account.total_resources) {
    throw new Error('[total_resources] is missing in account')
  }
  if (!account.cpu_limit) {
    throw new Error('[cpu_limit] is missing in account')
  }
  const { total_resources: totalResources, cpu_limit: cpuLimit } = account
  const cpuWeight = totalResources.cpu_weight.replace(' EOS', '')
  let price = bns.div(cpuWeight, cpuLimit.max.toString(), 16)
  price = bns.mul(price, '1024')
  price = bns.div(price, '3', 16)
  return price
}

const readEosPricesCacheJson = () => {
  const cacheData = fs.readFileSync(eosPricesFile, 'utf8')
  const cacheDataJson = JSON.parse(cacheData)
  return cacheDataJson
}

const updateEosPricesCache = async () => {
  try {
    const { chains } = CONFIG
    for (const chain in chains) {
      const result = await eosPrices(chain)
      let cacheData = fs.readFileSync(eosPricesFile, 'utf8')
      console.log('cacheData: ', cacheData)
      if (!cacheData) cacheData = '{}'
      let cacheDataJson = JSON.parse(cacheData)
      if (!cacheDataJson[chain]) cacheDataJson[chain] = {data: {}, lastUpdated: 0}
      cacheDataJson[chain].data = result
      cacheDataJson[chain].lastUpdated = (new Date()).getTime() / 1000
      fs.writeFileSync(eosPricesFile, JSON.stringify(cacheDataJson))
    }

  } catch (error) {
    console.log('Failed updating resources prices, error: ', error)
  }
}

module.exports = { eosPrices, readEosPricesCacheJson, updateEosPricesCache }

updateEosPricesCache()
setInterval(updateEosPricesCache, 60 * 1000)