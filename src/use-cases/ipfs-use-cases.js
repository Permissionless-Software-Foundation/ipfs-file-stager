/*
  Use case library for working with IPFS.

  BCH payments follow PS010 v2.0.0, Phase 1: the pin-service is the only source
  of the payout address and the sats/MB rate, the user pays sats directly to
  that payout address, and this app publishes the Pin Claim with the payment
  txid in field 2 of the OP_RETURN. There is no per-payment key pair, no WIF at
  rest, no sweep, and no PSF token burn.
*/

// Global npm libraries
// import { exporter } from 'ipfs-unixfs-exporter'
import fs from 'fs'
import axios from 'axios'
import PSFFPP from 'psffpp'

// Local libraries
// import wlogger from '../adapters/wlogger.js'
import config from '../../config/index.js'

class IpfsUseCases {
  constructor (localConfig = {}) {
    // console.log('User localConfig: ', localConfig)
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of adapters must be passed in when instantiating IPFS Use Cases library.'
      )
    }

    // Encapsulate dependencies
    this.fs = fs
    this.axios = axios
    this.config = config
    this.PSFFPP = PSFFPP
    // Client-side copy of the PS010 fee schedule, shipped by psffpp. Undefined
    // on older releases; getBchCost() fails closed in that case.
    this.requiredSatsBCH = PSFFPP.requiredSatsBCH

    // Bind 'this' object to all class subfunctions.
    this.upload = this.upload.bind(this)
    this.stat = this.stat.bind(this)
    this.clearStagedFiles = this.clearStagedFiles.bind(this)
    this.getPaymentAddr = this.getPaymentAddr.bind(this)
    this.createPinClaim = this.createPinClaim.bind(this)
    this.getBchCost = this.getBchCost.bind(this)
    this._getPinServiceQuote = this._getPinServiceQuote.bind(this)
    this._getPaymentTx = this._getPaymentTx.bind(this)
    this._satsPaidToAddress = this._satsPaidToAddress.bind(this)
    this._normalizeAddress = this._normalizeAddress.bind(this)

    // State
    this.cids = []
  }

  // Recieve a file via HTTP. Add it to the IPFS node.
  async upload (inObj = {}) {
    try {
      const { file } = inObj
      // console.log('file: ', file)

      const filename = file.originalFilename
      const size = file.size
      console.log(`File ${filename} with size ${size} bytes recieved.`)

      // Reject if file is bigger than 100 MB.
      const maxFileSize = 100000000
      if (size > maxFileSize) {
        throw new Error(`File exceeds max file size of ${maxFileSize}`)
      }

      const readStream = this.fs.createReadStream(file.filepath)
      // console.log('readStream: ', readStream)

      const fileObj = {
        path: filename,
        content: readStream
      }
      // console.log('fileObj: ', fileObj)

      const options = {
        cidVersion: 1,
        wrapWithDirectory: true
      }

      const fileData = await this.adapters.ipfs.ipfs.fs.addFile(fileObj, options)
      console.log('fileData: ', fileData)

      const cid = fileData.toString()

      // Add the CID to the state.
      const now = new Date()
      this.cids.push({
        cid,
        timestamp: now.toISOString()
      })

      return {
        success: true,
        cid
      }
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/upload()')
      throw err
    }
  }

  // Get statistics on a CID.
  async stat (inObj = {}) {
    try {
      const { cid } = inObj

      const stats = await this.adapters.ipfs.ipfs.fs.stat(cid)
      // console.log('stats: ', stats)

      const outObj = {
        cid: stats.cid,
        fileSize: Number(stats.fileSize)
      }
      console.log(`${JSON.stringify(outObj, null, 2)}`)

      return outObj
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/stat()')
      throw err
    }
  }

  // Clear staged files.
  // This function is called every 24 hours by a Timer Controller. It deletes
  // any files that were staged more than 24 hours ago.
  async clearStagedFiles () {
    // Get a list of CIDs to purge from the system.
    const now = new Date()
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const cidsToPurge = this.cids.filter(cid => new Date(cid.timestamp) < cutoff)

    for (let i = 0; i < cidsToPurge.length; i++) {
      const cid = cidsToPurge[i]
      console.log(`Purging CID ${cid.cid} from the system...`)

      try {
        await this.adapters.ipfs.ipfs.fs.rm(cid.cid)
        console.log(`Successfully deleted CID ${cid.cid} from the system.`)
      } catch (err) {
        console.error(`Error trying to delete CID ${cid.cid}: `, err)
      }

      // remove deleted cid from this.cids
      const index = this.cids.findIndex(val => cid.cid === val.cid)
      if (index !== -1) {
        this.cids.splice(index, 1)
      }
    }
    return true
  }

  // Fetch the Phase-1 payment quote from the pin-service (PS010 v2.0.0 §6,
  // step 1): GET {pinServiceUrl}/ipfs/payment-address → { address, satsPerMb }.
  //
  // Fails closed: if the pin-service can not be reached, or does not return
  // both a payout address and a rate, this throws. There is no hardcoded
  // fallback address and no fallback price.
  async _getPinServiceQuote () {
    if (!this.config.pinServiceUrl) {
      throw new Error('PIN_SERVICE_URL is not configured. Can not quote the cost of a pin.')
    }

    const url = `${this.config.pinServiceUrl}/ipfs/payment-address`

    let response
    try {
      response = await this.axios.get(url)
    } catch (err) {
      throw new Error(`Failed to get a pin price from ${url}: ${err.message}`)
    }

    const { address, satsPerMb } = response.data || {}

    if (!address || typeof address !== 'string') {
      throw new Error(`The pin-service at ${url} did not return a payout address. Refusing to quote a price.`)
    }
    if (typeof satsPerMb !== 'number' || !Number.isFinite(satsPerMb) || satsPerMb <= 0) {
      throw new Error(`The pin-service at ${url} did not return a usable satsPerMb rate. Refusing to quote a price.`)
    }

    return { address, satsPerMb }
  }

  // Get the payment address and the amount to pay, in sats, for a file.
  //
  // PS010 v2.0.0 Phase 1 has a single, operator-configured payout address for
  // the whole deployment, so this endpoint is a quote: no key pair is generated
  // and no payment record is stored. The response shape is kept for the
  // explorer: { address, satsRequired, bchCost }.
  async getPaymentAddr (inObj = {}) {
    try {
      const { sizeInMb } = inObj

      const { address, satsRequired, bchCost } = await this.getBchCost({ sizeInMb })

      return {
        address,
        satsRequired,
        bchCost
      }
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/getPaymentAddr(): ', err)
      throw err
    }
  }

  // Create a Pin Claim for a file that has already been paid for in BCH
  // (PS010 v2.0.0 §6, steps 4-6).
  //
  // 1. Fetch the payment TX. If it can not be found, the payment has not
  //    propagated yet, so this fails closed.
  // 2. Verify the payment TX pays the payout address advertised by the
  //    pin-service (any output, normalized cashaddr comparison).
  // 3. Build and broadcast the Pin Claim, with the payment txid in field 2.
  //
  // No sweep to the app wallet. No PSF burn. No payment record to update.
  async createPinClaim (inObj = {}) {
    try {
      const { cid, filename, paymentTxid } = inObj
      console.log('cid: ', cid)
      console.log('paymentTxid: ', paymentTxid)

      // Input validation
      if (!cid) {
        throw new Error('cid required to create a pin claim.')
      }
      if (!filename) {
        throw new Error('filename required to create a pin claim.')
      }
      if (!paymentTxid) {
        throw new Error('paymentTxid required to create a pin claim.')
      }

      const wallet = this.adapters.wallet.bchWallet

      // 1. Fetch the payment TX from the blockchain.
      const txData = await this._getPaymentTx({ paymentTxid, wallet })

      // 2. The payment must pay the pin-service payout address.
      const { address: payoutAddress } = await this._getPinServiceQuote()
      const satsPaid = this._satsPaidToAddress({ txData, address: payoutAddress })
      if (satsPaid === 0) {
        throw new Error(`Payment TX ${paymentTxid} does not pay the payout address ${payoutAddress}.`)
      }
      console.log(`Payment TX ${paymentTxid} pays ${satsPaid} sats to ${payoutAddress}.`)

      // 3. Build + broadcast the claim. The pin-service validates the amount.
      const psffpp = new this.PSFFPP({ wallet })
      if (typeof psffpp.createPinClaimBCH !== 'function') {
        throw new Error('The installed psffpp library does not implement createPinClaimBCH(). Update the psffpp dependency.')
      }
      const { claimTxid } = await psffpp.createPinClaimBCH({ cid, filename, paymentTxid })
      console.log('Created Pin Claim: ', claimTxid)

      return {
        success: true,
        paymentTxid,
        claimTxid
      }
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/createPinClaim(): ', err)
      throw err
    }
  }

  // Get the cost to pin a file, in satoshis (PS010 v2.0.0 §6, steps 1-3).
  //
  // The quote (payout address + sats/MB) comes from the pin-service, and the
  // amount is computed with the shared fee schedule, which already includes the
  // locked 100 KB minimum charge. Fails closed on any error or missing field.
  async getBchCost (inObj = {}) {
    try {
      const { sizeInMb } = inObj

      if (typeof sizeInMb !== 'number' || !Number.isFinite(sizeInMb) || sizeInMb < 0) {
        throw new Error('sizeInMb must be a finite number >= 0')
      }

      // The 100 KB floor is applied inside requiredSatsBCH(), not here.
      const fileSizeBytes = Math.ceil(sizeInMb * 1e6)

      const { address, satsPerMb } = await this._getPinServiceQuote()
      console.log(`Payout address ${address} at ${satsPerMb} sats/MB for ${fileSizeBytes} bytes.`)

      if (typeof this.requiredSatsBCH !== 'function') {
        throw new Error('The installed psffpp library does not implement requiredSatsBCH(). Update the psffpp dependency.')
      }

      const satsRequired = this.requiredSatsBCH({ fileSizeBytes, satsPerMb })
      console.log('satsRequired: ', satsRequired)

      const result = {
        address,
        satsRequired,
        // Decimal BCH, for display purposes.
        bchCost: satsRequired / 1e8
      }

      return result
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/getBchCost(): ', err)
      throw err
    }
  }

  // Fetch a transaction from the blockchain. Throws if it is not found, so that
  // a claim is never generated for a payment that the network has not seen.
  async _getPaymentTx (inObj = {}) {
    const { paymentTxid, wallet } = inObj

    let txData
    try {
      txData = await wallet.getTxData([paymentTxid])
    } catch (err) {
      throw new Error(`Could not fetch payment TX ${paymentTxid}: ${err.message}`)
    }

    // getTxData() returns an array; tolerate a single object too.
    if (Array.isArray(txData)) {
      txData = txData[0]
    }

    if (!txData) {
      throw new Error(`Payment TX ${paymentTxid} was not found on the blockchain.`)
    }

    return txData
  }

  // Sum the satoshis paid to a specific address by a transaction.
  // Returns 0 if the transaction does not pay the address.
  _satsPaidToAddress (inObj = {}) {
    const { txData, address } = inObj

    const target = this._normalizeAddress(address)
    const outputs = txData.vout || txData.outputs || []

    let satsPaid = 0
    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i]
      const scriptPubKey = output.scriptPubKey || {}

      let addresses = []
      if (Array.isArray(scriptPubKey.addresses)) {
        addresses = scriptPubKey.addresses
      } else if (scriptPubKey.address) {
        addresses = [scriptPubKey.address]
      } else if (scriptPubKey.hex) {
        // Some back ends omit the decoded address, so decode the script here.
        try {
          addresses = [this.adapters.wallet.bchWallet.bchjs.Address.fromOutputScript(Buffer.from(scriptPubKey.hex, 'hex'))]
        } catch (err) {
          addresses = []
        }
      }

      for (let j = 0; j < addresses.length; j++) {
        // Skip addresses that can not be normalized (e.g. exotic scripts).
        let normalized
        try {
          normalized = this._normalizeAddress(addresses[j])
        } catch (err) {
          continue
        }

        if (normalized === target) {
          satsPaid += Number(output.value)
        }
      }
    }

    return satsPaid
  }

  // Normalize a BCH address to its cashaddr form, so that comparison is stable
  // (legacy Base58 vs cashaddr). Throws on an unusable address.
  _normalizeAddress (address) {
    const bchjs = this.adapters.wallet.bchWallet.bchjs

    return bchjs.Address.toCashAddress(address)
  }
}

export default IpfsUseCases
