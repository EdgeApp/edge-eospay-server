import prices from '../cache/prices.json'
import { getEosActivationFee, updateEosRates } from './eos-name-server'
const rp = require('request-promise')
const { bns } = require('biggystring')
import { currentEosSystemRates, currentExchangeRates } from './common'
const CURRENCY_CODE = 'tlos'
const CONFIG = require(`../config/${CURRENCY_CODE.toLowerCase()}/${CURRENCY_CODE.toLowerCase()}ServerConfig`)

// console.log('prices are: ', prices)

export async function updateExchangeRates () {
  const doUpdate = await new Promise((resolve, reject) => {
    if (prices && prices.status && prices.status.timestamp){
      const now = new Date()
      const lastUpdate = (new Date (prices.status.timestamp)).getTime()
      // if it has not been over an hour
      if (now < lastUpdate + (10000000 * 60 * 60)) {
        // resolve with semi-old prices
        resolve(prices)
      }
    }
    let now = new Date()
    if (now.getTime() - currentExchangeRates.lastUpdated >= CONFIG.cryptoPricing.updateFrequencyMs) {
      const requestOptions = {
        method: 'GET',
        uri: CONFIG.cryptoPricing.rootPath + CONFIG.cryptoPricing.listings,
        qs: {
          start: 1,
          limit: 25,
          convert: 'USD'
        },
        headers: {
          'X-CMC_PRO_API_KEY': CONFIG.cryptoPricing.apiKey
        },
        json: true,
        gzip: true
      }

      rp(requestOptions).then(response => {
        // console.log('API call response:', response)
        now = new Date()

        currentExchangeRates.lastUpdated = now.getTime()
        currentExchangeRates.data = response.data

        // console.log('currentExchangeRates:', currentExchangeRates)

        resolve(currentExchangeRates)
      }).catch((err) => {
        console.log('API call error:', err.message, requestOptions)
        reject(err)
      })
    } else {
      resolve(currentExchangeRates)
    }
  })
  return doUpdate
}

export async function getLatestEosActivationPriceInSelectedCryptoCurrency (selectedCurrencyCode) {
  // updateCryptoPricing

  const _getLatest = await new Promise((resolve, reject) => {
    updateExchangeRates()
      .then((cryptoPricing) => {
        console.log(`getLatestEosActivationPriceInSelectedCryptoCurrency().cryptoPricing received ${cryptoPricing.data.length} cryptos`)
        getEosActivationFee().then(eosActivationFee => {
          const valuesInUSD = cryptoPricing.data
            .filter((crypto) => {
              return crypto.symbol === selectedCurrencyCode || crypto.symbol === 'EOS'
            })
            .map((crypto) => {
              console.log({ [`${crypto.symbol}_USD`]: crypto.quote.USD.price.toString() })
              return { [`${crypto.symbol}_USD`]: crypto.quote.USD.price.toString() }
            })

          console.log('valuesInUSD: ', JSON.stringify(valuesInUSD))


          const eosActivationFeeInUSD = bns.mul(eosActivationFee, valuesInUSD.filter(element => !!element.EOS_USD)[0].EOS_USD)
          const eosActivationFeeInSelectedCurrencyCode = bns.div(valuesInUSD.filter(element => !!element.EOS_USD)[0].EOS_USD, valuesInUSD.filter(element => !!element[`${selectedCurrencyCode}_USD`])[0][`${selectedCurrencyCode}_USD`], 10, 12)

          console.log('eosActivationFee: ', eosActivationFee)
          console.log('eosActivationFee in USD: ', eosActivationFeeInUSD)
          console.log(`calculated eosActivationFee in : ${selectedCurrencyCode}: `, eosActivationFeeInSelectedCurrencyCode)
          console.log('kylansomething')
          resolve(eosActivationFeeInUSD)
        })
          .catch(error => {
            console.log('getEosActivationFee().error:')
            console.log('getEosActivationFee().error: ', error)
            reject(error)
          })
      })
      .catch((error) => {
        console.log('getEosActivationFee().error2:')
        console.log('getLatestEosActivationPriceInSelectedCryptoCurrency().error: ', error)
        reject(error)
      })
  })

  return _getLatest
}

async function getEosActivationFee () {
  //requests current ram, net, cpu prices IN EOS from configured latest eosRates data provided from CONFIG.eosPricingRatesURL
  const getFee = await new Promise((resolve, reject) => {
    updateEosRates()
      .then(eosRates => {
        const eosPricingResponse = eosRates.data

        //apply minimum staked EOS amounts from Configs

        const net = CONFIG.eosAccountActivationStartingBalances.net
        const cpu = CONFIG.eosAccountActivationStartingBalances.cpu
        const netStakeMinimum = CONFIG.eosAccountActivationStartingBalances.minimumNetEOSStake
        const cpuStakeMinimum = CONFIG.eosAccountActivationStartingBalances.minimumCpuEOSStake

        let stakeNetQuantity = Number(bns.mul(eosPricingResponse.net, net)).toFixed(4) < Number(netStakeMinimum) ? Number(netStakeMinimum).toFixed(4) : Number(bns.mul(eosPricingResponse.net, net)).toFixed(4)
        let stakeCpuQuantity = Number(bns.mul(eosPricingResponse.cpu, cpu)).toFixed(4) < Number(cpuStakeMinimum) ? Number(cpuStakeMinimum).toFixed(4) : Number(bns.mul(eosPricingResponse.cpu, cpu)).toFixed(4)

        console.log (`stakeNetQuantity: ${stakeNetQuantity}`)
        console.log (`stakeCpuQuantity: ${stakeCpuQuantity}`)

        const totalEos = bns.add(
          bns.add(
            bns.mul(eosPricingResponse.ram, bns.div(CONFIG.eosAccountActivationStartingBalances.ram, '1000', 10, 3)),
            stakeNetQuantity.toString()
          ),
          stakeCpuQuantity.toString()
        )

        console.log(`totalEos: ${totalEos}`)
        // change value later
        resolve('1' /*totalEos*/)
      })
      .catch(error => console.log('Error in getEosActivationFee()', error))
  })

  return getFee
}

async function updateEosRates () {
  const doUpdate = await new Promise((resolve, reject) => {
    let now = new Date()
    if (now.getTime() - currentEosSystemRates.lastUpdated >= CONFIG.cryptoPricing.updateFrequencyMs) {
      const requestOptions = {
        method: 'GET',
        uri: CONFIG.eosPricingRatesURL,
        json: true,
        gzip: true
      }

      rp(requestOptions).then(eosPricingResponse => {
        now = new Date()
        console.log('eosPricingResponse: ', eosPricingResponse)
        console.log(1)
        currentEosSystemRates.lastUpdated = now.getTime()
        console.log(2)
        currentEosSystemRates.data = eosPricingResponse
        console.log(3)
        resolve(currentEosSystemRates)
      }).catch(error => {
        console.log('Error in eos pricing: ', error)
        reject(error)
      })
    } else {
      resolve(currentEosSystemRates)
    }
  })

  return doUpdate
}