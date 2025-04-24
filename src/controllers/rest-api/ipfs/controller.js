/*
  REST API Controller library for the /ipfs route
*/

// Global npm libraries

// Local libraries
import wlogger from '../../../adapters/wlogger.js'
import config from '../../../../config/index.js'

class IpfsRESTControllerLib {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of Adapters library required when instantiating /ipfs REST Controller.'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of Use Cases library required when instantiating /ipfs REST Controller.'
      )
    }

    // Encapsulate dependencies
    // this.UserModel = this.adapters.localdb.Users
    // this.userUseCases = this.useCases.user
    this.config = config

    // Bind 'this' object to all subfunctions
    this.getStatus = this.getStatus.bind(this)
    this.getPeers = this.getPeers.bind(this)
    this.getRelays = this.getRelays.bind(this)
    this.handleError = this.handleError.bind(this)
    this.connect = this.connect.bind(this)
    this.getThisNode = this.getThisNode.bind(this)
    this.upload = this.upload.bind(this)
    this.stat = this.stat.bind(this)
    this.getPaymentAddr = this.getPaymentAddr.bind(this)
    this.createPinClaim = this.createPinClaim.bind(this)
  }

  /**
   * @api {get} /ipfs Get status on IPFS infrastructure
   * @apiPermission public
   * @apiName GetIpfsStatus
   * @apiGroup REST BCH
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5001/ipfs
   *
   */
  async getStatus (ctx) {
    try {
      const status = await this.adapters.ipfs.getStatus()

      ctx.body = { status }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getStatus(): ')
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Return information on IPFS peers this node is connected to.
  async getPeers (ctx) {
    try {
      const showAll = ctx.request.body.showAll

      const peers = await this.adapters.ipfs.getPeers(showAll)

      ctx.body = { peers }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getPeers(): ')
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Get data about the known Circuit Relays. Hydrate with data from peers list.
  async getRelays (ctx) {
    try {
      const relays = await this.adapters.ipfs.getRelays()

      ctx.body = { relays }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getRelays(): ')
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  async connect (ctx) {
    try {
      const multiaddr = ctx.request.body.multiaddr
      const getDetails = ctx.request.body.getDetails

      // console.log('this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.adapters.ipfs: ', this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.adapters.ipfs)
      const result = await this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.adapters.ipfs.connectToPeer({ multiaddr, getDetails })
      // console.log('result: ', result)

      ctx.body = result
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/connect():', err)
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {get} /ipfs/node Get a copy of the thisNode object from helia-coord
   * @apiPermission public
   * @apiName GetThisNode
   * @apiGroup REST BCH
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5001/ipfs/node
   *
   */
  async getThisNode (ctx) {
    try {
      const thisNode = this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.thisNode

      ctx.body = { thisNode }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getThisNode(): ')
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Upload a file via HTTP and add it to the IPFS node.
  async upload (ctx) {
    try {
      // console.log('ctx.request.files: ', ctx.request.files)

      const file = ctx.request.files.file
      // console.log('file: ', file)

      const result = await this.useCases.ipfs.upload({ file })

      ctx.body = result
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/upload(): ', err)
      this.handleError(ctx, err)
    }
  }

  // Get statistics on a CID.
  async stat (ctx) {
    try {
      const cid = ctx.params.cid
      // console.log(`stat() getting data on CID ${cid}...`)

      const result = await this.useCases.ipfs.stat({ cid })

      ctx.body = result
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/stat(): ', err)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {post} /ipfs/getPaymentAddr Get a payment address to pay for file upload in BCH.
   * @apiPermission public
   * @apiName GetPaymentAddr
   * @apiGroup REST BCH
   * @apiDescription Get a payment address to pay for file upload in BCH.
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X POST -d '{ "sizeInMb": 1 }' localhost:5040/ipfs/getPaymentAddr
   *
   */
  async getPaymentAddr (ctx) {
    try {
      if (!this.config.enableBchPayments) {
        console.log('Throwing error. This is expected behavior.')
        ctx.throw(501, 'BCH payments are not enabled in this instance of ipfs-file-stager.')
      }

      const { sizeInMb } = ctx.request.body

      const result = await this.useCases.ipfs.getPaymentAddr({ sizeInMb })

      ctx.body = result
    } catch (err) {
      console.error('Error in ipfs/controller.js/getPaymentAddr(): ', err)
      // wlogger.error('Error in ipfs/controller.js/getPaymentAddr(): ', err)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {post} /ipfs/createPinClaim Create a Pin Claim for a file.
   * @apiPermission public
   * @apiName createPinClaim
   * @apiGroup REST BCH
   * @apiDescription Create a Pin Claim for a file if the payment address has been funded.
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X POST -d '{ "address": "bitcoincash:qq0jhnhd8wjjfx0295vafhku3vj9s5j3zcfcg2zlyn", "cid": "bafybeidhiave6yci6gih6ixv5dp63p2qsgfxei4fwg77fov45qezewlpgq" }' localhost:5040/ipfs/createPinClaim
   *
   */
  async createPinClaim (ctx) {
    try {
      const { address, cid } = ctx.request.body

      const result = await this.useCases.ipfs.createPinClaim({ address, cid })

      ctx.body = result
    } catch (err) {
      console.error('Error in ipfs/controller.js/createPinClaim(): ', err)
      this.handleError(ctx, err)
    }
  }

  // DRY error handler
  handleError (ctx, err) {
    // If an HTTP status is specified by the buisiness logic, use that.
    if (err.status) {
      if (err.message) {
        ctx.throw(err.status, err.message)
      } else {
        ctx.throw(err.status)
      }
    } else {
      // By default use a 422 error if the HTTP status is not specified.
      ctx.throw(422, err.message)
    }
  }
}

// module.exports = IpfsRESTControllerLib
export default IpfsRESTControllerLib
