/*
  Use case library for working with IPFS.
*/

// Global npm libraries
// import { exporter } from 'ipfs-unixfs-exporter'
import fs from 'fs'
import axios from 'axios'

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

    // Bind 'this' object to all class subfunctions.
    this.upload = this.upload.bind(this)
    this.stat = this.stat.bind(this)
    this.clearStagedFiles = this.clearStagedFiles.bind(this)
    this.getPaymentAddr = this.getPaymentAddr.bind(this)
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

      const bchCost = bchjs.Util.floor8(psfCost * bchPerToken * (1 + this.config.markup))
      console.log('bchCost: ', bchCost)
      // const result = await this.adapters.wallet.getPaymentAddr()
      // return result

      // Generate a new key pair
      const { cashAddress, hdIndex } = await this.adapters.wallet.getKeyPair()

      const now = new Date()

      // Create a new BCH payment database model.
      const paymentModel = {
        address: cashAddress,
        bchCost,
        timeCreated: now.toISOString(),
        hdIndex
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
}

export default IpfsUseCases
