const currentExchangeRates = require('../cache/prices.json')
const fs = require('fs')
import { getEosActivationFee } from "./eos-name-server"
const requestPromise = require("request-promise")
const { bns } = require("biggystring")
import { currentEosSystemRates, currentExchangeRates } from "./common"
const CONFIG = require(`../config/serverConfig`)

// get recent fiat prices
export async function updateExchangeRates() {
  const doUpdate = await new Promise((resolve, reject) => {
    if (currentExchangeRates && currentExchangeRates.lastUpdated) {
      const now = new Date()
      const lastUpdate = new Date(currentExchangeRates.lastUpdated).getTime()
      // if it has not been over an hour
      if (now < lastUpdate + 1000 * 60 * 60) {
        // resolve with semi-old currentExchangeRates
        resolve(currentExchangeRates)
      }
    }
    let now = new Date()
    if (
      now.getTime() - currentExchangeRates.lastUpdated >=
      CONFIG.cryptoPricing.updateFrequencyMs
    ) {
      const requestOptions = {
        method: "GET",
        uri: CONFIG.cryptoPricing.rootPath + CONFIG.cryptoPricing.listings,
        qs: {
          start: 1,
          limit: 25,
          convert: "USD",
        },
        headers: {
          "X-CMC_PRO_API_KEY": CONFIG.cryptoPricing.apiKey,
        },
        json: true,
        gzip: true,
      }

      requestPromise(requestOptions)
        .then((response) => {
          // console.log('API call response:', response)
          now = new Date()

          currentExchangeRates.lastUpdated = now.getTime()
          currentExchangeRates.data = response.data

          // console.log('currentExchangeRates:', currentExchangeRates)

          resolve(currentExchangeRates)
        })
        .catch((err) => {
          console.log("API call error:", err.message, requestOptions)
          reject(err)
        })
    } else {
      resolve(currentExchangeRates)
    }
  })
  return doUpdate
}

export async function getLatestEosActivationPriceInSelectedCryptoCurrency(
  selectedCurrencyCode
) {
  try {
    // get exchange rates
    const cryptoPricing = await updateExchangeRates()
    fs.writeFileSync('cache/prices.json', JSON.stringify(cryptoPricing))
    console.log(
      `getLatestEosActivationPriceInSelectedCryptoCurrency().cryptoPricing received ${cryptoPricing.data.length} cryptos`
    )
    const eosActivationFee = await getEosActivationFee()
    const valuesInUSD = cryptoPricing.data
      .filter((crypto) => {
        return (
          crypto.symbol === selectedCurrencyCode || 'EOS'
        )
      })
      .map((crypto) => {
        console.log({
          [`${crypto.symbol}_USD`]: crypto.quote.USD.price.toString(),
        })
        return { [`${crypto.symbol}_USD`]: crypto.quote.USD.price.toString() }
      })

    console.log("valuesInUSD: ", JSON.stringify(valuesInUSD))
    const eosActivationFeeInUSD = bns.mul(
      eosActivationFee,
      valuesInUSD.filter((element) => !!element.EOS_USD)[0].EOS_USD
    )
    const eosActivationFeeInSelectedCurrencyCode = bns.div(
      valuesInUSD.filter((element) => !!element.EOS_USD)[0].EOS_USD,
      valuesInUSD.filter(
        (element) => !!element[`${selectedCurrencyCode}_USD`]
      )[0][`${selectedCurrencyCode}_USD`],
      10,
      12
    )

    console.log("eosActivationFee: ", eosActivationFee)
    console.log("eosActivationFee in USD: ", eosActivationFeeInUSD)
    console.log(
      `calculated eosActivationFee in : ${selectedCurrencyCode}: `,
      eosActivationFeeInSelectedCurrencyCode
    )
    const _getLatest = eosActivationFeeInUSD
    return _getLatest
  } catch (error) {
    console.log("getEosActivationFee().error: ", error)
  }
}

// get EOS / resource
export async function getUpdatedEosRates() {
  const { eosPricingRatesURL, cryptoPricing } = CONFIG
  let rates
  try {
    let now = new Date()
    if (
      now.getTime() - currentEosSystemRates.lastUpdated >=
      cryptoPricing.updateFrequencyMs
    ) {
      const requestOptions = {
        method: "GET",
        uri: eosPricingRatesURL,
        json: true,
        gzip: true,
      }
      const eosPricingResponse = await requestPromise(requestOptions)
      now = new Date()
      console.log("eosPricingResponse: ", eosPricingResponse)
      currentEosSystemRates.lastUpdated = now.getTime()
      currentEosSystemRates.data = eosPricingResponse
      rates = currentEosSystemRates
      return rates
    }
  } catch (error) {
    console.log("Error in eos pricing: ", error)
    // reject(error)
  }
}

// returns "234.234234", # of token units
async function getEosActivationFee(): string {
  console.log(1)
  const { eosAccountActivationStartingBalances } = CONFIG
  //requests current ram, net, cpu prices IN EOS from configured latest eosRates data provided from CONFIG.eosPricingRatesURL
  try {
    console.log(2)
    const eosRates = await getUpdatedEosRates()
    console.log(3)
    const eosPricingResponse = eosRates.data

    //apply minimum staked EOS amounts from Configs

    const startingNetBalance = eosAccountActivationStartingBalances.net
    const startingCpuBalance = eosAccountActivationStartingBalances.cpu
    // net staked EOS minimum
    const netStakeMinimum =
      eosAccountActivationStartingBalances.minimumNetEOSStake
    // CPU staked EOS minimum
    const cpuStakeMinimum =
      eosAccountActivationStartingBalances.minimumCpuEOSStake

    // EOS / unit of NET * NET = EOS
    const amountEosFoStartingNet = Number(bns.mul(eosPricingResponse.net, startingNetBalance)).toFixed(4)
    // take larger between minimum and staking start
    let stakeNetQuantity = amountEosFoStartingNet < Number(netStakeMinimum) ?
      Number(netStakeMinimum).toFixed(4) : amountEosFoStartingNet

    const amountEosForStartingCpu = Number(bns.mul(eosPricingResponse.cpu, startingCpuBalance)).toFixed(4)
    // take larger between minimum and staking start
    let stakeCpuQuantity = amountEosForStartingCpu < Number(cpuStakeMinimum)
        ? Number(cpuStakeMinimum).toFixed(4) : amountEosForStartingCpu

    console.log(`stakeNetQuantity: ${stakeNetQuantity}`)
    console.log(`stakeCpuQuantity: ${stakeCpuQuantity}`)

    const quantityRam = bns.div(eosAccountActivationStartingBalances.ram, '1000', 10, 3)
    const stakeRamEosQuantity = bns.mul(eosPricingResponse.ram, quantityRam)
    const totalEos = bns.add(bns.add(stakeRamEosQuantity, stakeNetQuantity), stakeCpuQuantity)

    console.log(`totalEos: ${totalEos}`)
    // change value later
    return totalEos
  } catch (e) {
    console.log("Error in getEosActivationFee()", e)
  }
}
