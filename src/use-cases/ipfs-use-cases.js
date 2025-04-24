/*
  Use case library for working with IPFS.
*/

// Global npm libraries
// import { exporter } from 'ipfs-unixfs-exporter'
import fs from 'fs'
import axios from 'axios'
import BchTokenSweep from 'bch-token-sweep'
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
    this.BchTokenSweep = BchTokenSweep
    this.PSFFPP = PSFFPP

    // Bind 'this' object to all class subfunctions.
    this.upload = this.upload.bind(this)
    this.stat = this.stat.bind(this)
    this.clearStagedFiles = this.clearStagedFiles.bind(this)
    this.getPaymentAddr = this.getPaymentAddr.bind(this)
    this.createPinClaim = this.createPinClaim.bind(this)

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

      const readStream = fs.createReadStream(file.filepath)
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
    const cidsToPurge = this.cids.filter(cid => new Date(cid.timestamp) > cutoff)

    for (let i = 0; i < cidsToPurge.length; i++) {
      const cid = cidsToPurge[i]
      console.log(`Purging CID ${cid.cid} from the system...`)

      try {
        await this.adapters.ipfs.ipfs.fs.rm(cid.cid)
        console.log(`Successfully deleted CID ${cid.cid} from the system.`)
      } catch (err) {
        console.error(`Error trying to delete CID ${cid.cid}: `, err)
      }
    }
  }

  // Generate a new payment model. Calculate the cost to write the data, in BCH.
  async getPaymentAddr (inObj = {}) {
    try {
      const { sizeInMb } = inObj

      const wallet = this.adapters.wallet.bchWallet
      const bchjs = wallet.bchjs

      // Get the cost in PSF tokens to write 1MB to the network.
      const writePrice = await wallet.getPsfWritePrice()
      console.log('ipfs-use-cases.js/getPaymentAddr() writePrice: ', writePrice)

      // Get the current cost of PSF tokens in BCH.
      const response = await this.axios.get('https://psfoundation.cash/price')
      const usdPerBch = response.data.usdPerBCH
      const usdPerToken = response.data.usdPerToken
      console.log('usdPerBch: ', usdPerBch)
      console.log('usdPerToken: ', usdPerToken)
      const bchPerToken = bchjs.Util.floor8(usdPerToken / usdPerBch)
      console.log('ipfs-use-cases.js/getPaymentAddr() bchPerToken: ', bchPerToken)

      // Cost to user in BCH will be the price to write the file plus 10% markup.
      const psfCost = sizeInMb * writePrice
      console.log('psfCost: ', psfCost)

      // Expected transaction fees in BCH.
      const txFees = 0.00002

      const bchCost = bchjs.Util.floor8(psfCost * bchPerToken * (1 + this.config.markup) + txFees)
      console.log('bchCost: ', bchCost)
      // const result = await this.adapters.wallet.getPaymentAddr()
      // return result

      // Generate a new key pair
      const { cashAddress, wif, hdIndex } = await this.adapters.wallet.getKeyPair()
      console.log(`Got address ${cashAddress} from hdIndex ${hdIndex}.`)

      const now = new Date()

      // Create a new BCH payment database model.
      const paymentModel = {
        address: cashAddress,
        wif,
        bchCost,
        timeCreated: now.toISOString(),
        hdIndex,
        sizeInMb
      }
      const bchPaymentModel = new this.adapters.localdb.BchPayment(paymentModel)
      await bchPaymentModel.save()

      const result = {
        address: cashAddress,
        bchCost
      }

      return result
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/getPaymentAddr(): ', err)
      throw err
    }
  }

  // Create a new Pin Claim if the payment address has been funded.
  async createPinClaim (inObj = {}) {
    try {
      const { address, cid, filename } = inObj
      console.log('cid: ', cid)
      console.log('address: ', address)
      const paymentModel = await this.adapters.localdb.BchPayment.findOne({ address })
      if (!paymentModel) {
        throw new Error(`Payment address ${address} not found in database.`)
      }
      console.log('paymentModel: ', paymentModel)

      const wallet = this.adapters.wallet.bchWallet

      // Verify payment exists and is equal to or greater than the quoted cost.
      const paymentAddress = paymentModel.address
      const paymentBalance = await wallet.getBalance({ bchAddress: paymentAddress })
      if (paymentBalance < paymentModel.bchCost) {
        throw new Error(`Payment address ${paymentAddress} has insufficient balance.`)
      }

      // Sweep funds to the main wallet.
      const sweeper = new this.BchTokenSweep(
        paymentModel.wif,
        wallet.walletInfo.privateKey,
        wallet
      )
      await sweeper.populateObjectFromNetwork()
      const hex = await sweeper.sweepTo(wallet.walletInfo.cashAddress)
      const txid = await wallet.ar.sendTx(hex)
      console.log('Swept funds to main app wallet: ', txid)

      // Issue a Pin Claim.
      const psffpp = new this.PSFFPP({ wallet })
      const pinObj = {
        cid,
        filename,
        fileSizeInMegabytes: parseInt(paymentModel.sizeInMb)
      }
      const { pobTxid, claimTxid } = await psffpp.createPinClaim(pinObj)
      console.log('Created Pin Claim: ', { pobTxid, claimTxid })

      // Update the model
      paymentModel.pobTxId = pobTxid
      paymentModel.claimTxId = claimTxid
      await paymentModel.save()

      const result = {
        success: true,
        pobTxid,
        claimTxid
      }

      return result
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/createPinClaim(): ', err)
      throw err
    }
  }
}

export default IpfsUseCases
