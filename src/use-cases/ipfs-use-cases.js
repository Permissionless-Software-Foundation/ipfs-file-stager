/*
  Use case library for working with IPFS.
*/

// Global npm libraries
// import { exporter } from 'ipfs-unixfs-exporter'
import fs from 'fs'

// Local libraries
// import wlogger from '../adapters/wlogger.js'

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
    // this.exporter = exporter
    this.fs = fs

    // Bind 'this' object to all class subfunctions.
    this.upload = this.upload.bind(this)
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

      return {
        success: true,
        cid
      }
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/upload()')
      throw err
    }
  }
}

export default IpfsUseCases
