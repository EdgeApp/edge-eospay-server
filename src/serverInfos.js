// @flow

export type CheckServerInfo = {
  serverList: Array<{serverUrl: string, blockHeight: number}>,
  currencyCode: string,
  blockMerkle1k: string,
  blockMerkle500k: string,
  blockMerkle1400k: string,
  checkTxid: string,
  txRawSegwit: string | null,
  txRawNonSegwit: string | null,
  wantSegwit: boolean,
  wantV11: boolean,
  wantElectrumX: boolean
}

const _bc1ServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BC1',
  blockMerkle1k: '',
  blockMerkle500k: '31951c69428a95a46b517ffb0de12fec1bd0b2392aec07b64573e03ded31621f',
  blockMerkle1400k: '',
  checkTxid: 'ef298148f25162db85127b83daefe07e46b06078f95aa30969b007a09a722b61',
  txRawSegwit: '01000000000102f8a7d578817bb42636a2552de53db82',
  txRawNonSegwit: '0100000002f8a7d578817bb4',
  wantSegwit: true,
  wantV11: true,
  wantElectrumX: true
}

const _btcServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BTC',
  blockMerkle1k: '',
  blockMerkle500k: '31951c69428a95a46b517ffb0de12fec1bd0b2392aec07b64573e03ded31621f',
  blockMerkle1400k: '',
  checkTxid: 'ef298148f25162db85127b83daefe07e46b06078f95aa30969b007a09a722b61',
  txRawSegwit: '01000000000102f8a7d578817bb42636a2552de53db82',
  txRawNonSegwit: '0100000002f8a7d578817bb4',
  wantSegwit: false,
  wantV11: false,
  wantElectrumX: true
}

const _ltcServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'LTC',
  blockMerkle1k: '',
  blockMerkle500k: '2a5a10a1fdfb8f1d4278fb15a04d5b0b1d0859f711172528478fceb40dfdb199',
  blockMerkle1400k: '',
  checkTxid: '0a3d7d238a4b91386b78b477490e21927f94b65e5f107d1c9db2a545a1bfd968',
  txRawSegwit: '01000000000101b94c5ae03c29a936d226205495eed6aeaa44f8a13df7fd83595b5411f5caefa60100000017160',
  txRawNonSegwit: null,
  wantSegwit: true,
  wantV11: true,
  wantElectrumX: true
}

const _bchServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BCH',
  blockMerkle1k: '',
  blockMerkle500k: '4af279645e1b337e655ae3286fc2ca09f58eb01efa6ab27adedd1e9e6ec19091',
  blockMerkle1400k: '',
  checkTxid: '93fc1366642e328fdfa87d7e1c59e5d06216eecb7f836845b346ccf06e73ee95',
  txRawSegwit: null,
  txRawNonSegwit: '01000000013b0d0868079c7926dd0d91d57ee79482b2a437c2a070dcada0d8745b8f001099000000006b48304502210094695303fb22be1c9174d8cf9679c0cb4ead134b2ac21361f06b5954320c8b4802200171c3267664cc3b2449d07c5bfb57eb815fb6dac6641baacfba8730bc32f4604121021eb65684bd854bf34d',
  wantSegwit: false,
  wantV11: true,
  wantElectrumX: true
}

const _dashServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'DASH',
  blockMerkle1k: '',
  blockMerkle500k: '9d0ee1ce292af212d2f864482faff376b81a20c72c256c053d870e064c919de4',
  blockMerkle1400k: '',
  checkTxid: '43cdc29b486d6030b077b73be0439eb3f229ddaffff805bcead32d0a07fff094',
  txRawSegwit: null,
  txRawNonSegwit: '0100000001f29662799c0f63dba9ceeffa1876a916b5b9b085e8c422ae15d1d44a1bc4eb64010000006a47304402201850c519a44488c12f8a9fbace8fb268921f9436b8951a46d3777ab25c7ecc450220321eca800b898b0b62ec44e114fe29151d9fe54b0e7012e1a70d22db30046a3c012102cd93a',
  wantSegwit: false,
  wantV11: true,
  wantElectrumX: true
}

const _qtumServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'QTUM',
  blockMerkle1k: '8b49b57525515b55964dd4e65330c9484a9e5d6740ab0a6d184ca95a51733879',
  blockMerkle500k: '',
  blockMerkle1400k: '',
  checkTxid: '7fc7899d61270259d3d586d170ed375a0fa4d3bdaa9d3301bde6e38e5f24e64a',
  txRawSegwit: '020000000119a2aa0d6fc5b60c52df00ed86ca82c218f045ff9ff003dd821e191fbe50e9ec010000006a47304402201226caa3ab6376237803dce1bdb2c174a385cce097fdd2d0d45969b7e7f002a5022007affb86f70ffd9a33981454e2583241f364664ebfdb93a6c91feb59f2667e220121021cac6fcf6',
  txRawNonSegwit: null,
  wantSegwit: true,
  wantV11: true,
  wantElectrumX: true
}

const _badServerInfo: CheckServerInfo = {
  serverList: [],
  currencyCode: 'BAD',
  blockMerkle1k: '',
  blockMerkle500k: '',
  blockMerkle1400k: '',
  checkTxid: '',
  txRawSegwit: null,
  txRawNonSegwit: null,
  wantSegwit: false,
  wantV11: false,
  wantElectrumX: false
}

const serverInfos: Array<CheckServerInfo> = [
  _badServerInfo,
  _bc1ServerInfo,
  _btcServerInfo,
  _ltcServerInfo,
  _bchServerInfo,
  _qtumServerInfo,
  _dashServerInfo
]

module.exports = { serverInfos }
