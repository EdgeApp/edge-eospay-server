import { getEosActivationFee } from './eos-name-server'
import axios from 'axios'
const CONFIG = require('../config/serverConfig')
const requestPromise = require('request-promise')
const { bns } = require('biggystring')

const currentExchangeRates = {
  lastUpdated: 0,
  data: []
}

// get recent fiat prices
export async function updateExchangeRates() {
  const doUpdate = await new Promise((resolve, reject) => {
    if (currentExchangeRates && currentExchangeRates.lastUpdated) {
      const now = new Date()
      const lastUpdate = new Date(currentExchangeRates.lastUpdated).getTime()
      // if it has not been over an hour
      // starts off with empty data upon boot-up
      if (now < lastUpdate + 1000 * 60 * 60) {
        // resolve with semi-old currentExchangeRates
        resolve(currentExchangeRates)
      }
    }
    // otherwise update with fetched pricing
    let now = new Date()
    if (
      now.getTime() - currentExchangeRates.lastUpdated >=
      CONFIG.cryptoPricing.updateFrequencyMs
    ) {
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

      requestPromise(requestOptions)
        .then(async response => {
          // console.log('API call response:', response)
          now = new Date()

          currentExchangeRates.lastUpdated = now.getTime()
          currentExchangeRates.data = response.data
          console.log('currentExchangeRates:', currentExchangeRates)
          const telosRateReply = await axios(
            'https://api.coingecko.com/api/v3/coins/telos?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false'
          )
          const telosRate = telosRateReply.data.market_data.current_price.usd
          currentExchangeRates.data.push({
            name: 'Telos',
            quote: {
              USD: {
                price: telosRate
              }
            },
            symbol: 'TLOS'
          })

          resolve(currentExchangeRates)
        })
        .catch(err => {
          console.log('API call error:', err.message, requestOptions)
          reject(err)
        })
    } else {
      resolve(currentExchangeRates)
    }
  })
  return doUpdate
}

export async function getLatestEosActivationPriceInSelectedCryptoCurrency(
  paymentCurrencyCode,
  requestedAccountCurrencyCode = 'EOS'
) {
  try {
    // get exchange rates
    const cryptoPricing = await updateExchangeRates()
    console.log(
      `getLatestEosActivationPriceInSelectedCryptoCurrency().cryptoPricing received ${cryptoPricing.data.length} cryptos`
    )
    const eosActivationFee = await getEosActivationFee(requestedAccountCurrencyCode)
    const valuesInUSD = cryptoPricing.data
      .filter(crypto => {
        return crypto.symbol === paymentCurrencyCode || 'EOS'
      })
      .map(crypto => {
        console.log({
          [`${crypto.symbol}_USD`]: crypto.quote.USD.price.toString()
        })
        return { [`${crypto.symbol}_USD`]: crypto.quote.USD.price.toString() }
      })

    const chainRatePair = `${requestedAccountCurrencyCode}_USD`
    // console.log("valuesInUSD: ", JSON.stringify(valuesInUSD))
    const rate = valuesInUSD.find(element => element[chainRatePair])
    const rateInUsd = rate[chainRatePair]
    const eosActivationFeeInUSD = bns.mul(eosActivationFee, rateInUsd)
    const selectedCurrencyRate = valuesInUSD.find(element => element[`${paymentCurrencyCode}_USD`])
    const selectedCurrencyRateInUSD = selectedCurrencyRate[`${paymentCurrencyCode}_USD`]
    const eosActivationFeeInpaymentCurrencyCode = bns.div(
      rateInUsd,
      selectedCurrencyRateInUSD,
      10,
      12
    )

    console.log('eosActivationFee: ', eosActivationFee)
    console.log('eosActivationFee in USD: ', eosActivationFeeInUSD)
    console.log(
      `calculated eosActivationFee in : ${paymentCurrencyCode}: `,
      eosActivationFeeInpaymentCurrencyCode // ie how much Bitcoin
    )
    // only used for setting minimum USD fee
    // if (bns.gt(CURRENCY_CONFIG.minimumInvoiceAmountInUsd, eosActivationFeeInUSD)) {
    //   return CURRENCY_CONFIG.minimumInvoiceAmountInUsd
    // }
    return eosActivationFeeInUSD // returns USD cost of activation
  } catch (error) {
    console.log('getEosActivationFee().error: ', error)
  }
}

// returns "234.234234", # of token units
async function getEosActivationFee (requestedAccountCurrencyCode = 'eos'): string {
  console.log(1)
  const requestedAccountCurrencyCodeLowerCase = requestedAccountCurrencyCode.toLowerCase()
  const { eosAccountActivationStartingBalances } = CONFIG.chains[
    requestedAccountCurrencyCodeLowerCase
  ]
  // requests current ram, net, cpu prices IN EOS from configured latest eosRates data provided from CONFIG.eosPricingRatesURL
  try {
    const eosRates = CONFIG.chains[requestedAccountCurrencyCodeLowerCase].resourcePrices

    // apply minimum staked EOS amounts from Configs
    const startingNetBalance = eosAccountActivationStartingBalances.net
    const startingCpuBalance = eosAccountActivationStartingBalances.cpu
    // net staked EOS minimum
    const netStakeMinimum = eosAccountActivationStartingBalances.minimumNetEOSStake
    // CPU staked EOS minimum
    const cpuStakeMinimum = eosAccountActivationStartingBalances.minimumCpuEOSStake

    // EOS / unit of NET * NET = EOS

    const amountEosFoStartingNet = Number(
      bns.mul(eosRates.net.toString(), startingNetBalance)
    ).toFixed(4)
    // take larger between minimum and staking start
    const stakeNetQuantity =
      amountEosFoStartingNet < Number(netStakeMinimum)
        ? Number(netStakeMinimum).toFixed(4)
        : amountEosFoStartingNet

    const amountEosForStartingCpu = Number(
      bns.mul(eosRates.cpu.toString(), startingCpuBalance)
    ).toFixed(4)
    // take larger between minimum and staking start
    const stakeCpuQuantity =
      amountEosForStartingCpu < Number(cpuStakeMinimum)
        ? Number(cpuStakeMinimum).toFixed(4)
        : amountEosForStartingCpu

    console.log(`stakeNetQuantity: ${stakeNetQuantity}`)
    console.log(`stakeCpuQuantity: ${stakeCpuQuantity}`)

    const quantityRam = bns.div(eosAccountActivationStartingBalances.ram.toString(), '1000', 10, 3)
    const stakeRamEosQuantity = bns.mul(eosRates.ram.toString(), quantityRam)
    const totalEos = bns.add(bns.add(stakeRamEosQuantity, stakeNetQuantity), stakeCpuQuantity)

    console.log(`totalEos: ${totalEos}`)
    // change value later
    return totalEos
  } catch (error) {
    console.log('Error in getEosActivationFee()', error)
  }
}
