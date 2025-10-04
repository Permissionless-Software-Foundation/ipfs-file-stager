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
    this.getBchCost = this.getBchCost.bind(this)
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

  /**
   * @api {post} /ipfs/peers Get information on IPFS peers this node is connected to
   * @apiPermission public
   * @apiName GetIpfsPeers
   * @apiGroup REST IPFS
   *
   * @apiParam {Boolean} [showAll=false] Whether to include detailed peer data
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X POST localhost:5001/ipfs/peers \
   *   -d '{"showAll": false}'
   *
   * @apiSuccess {Object[]} peers Array of peer objects
   * @apiSuccess {String} peers[].peer Peer ID
   * @apiSuccess {String} peers[].name Peer name
   * @apiSuccess {String} peers[].protocol Protocol used by the peer
   * @apiSuccess {String} peers[].version Peer version
   * @apiSuccess {String} peers[].connectionAddr Connection address
   * @apiSuccess {Object} [peers[].peerData] Detailed peer data (when showAll=true)
   */
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

  /**
   * @api {post} /ipfs/relays Get data about the known Circuit Relays
   * @apiPermission public
   * @apiName GetIpfsRelays
   * @apiGroup REST IPFS
   *
   * @apiDescription Returns information about Circuit Relays, both v1 and v2, that this node knows about. V2 relays are hydrated with peer data from the connected peers list.
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X POST localhost:5001/ipfs/relays
   *
   * @apiSuccess {Object} relays Object containing relay information
   * @apiSuccess {Object[]} relays.v2Relays Array of v2 Circuit Relay objects
   * @apiSuccess {String} relays.v2Relays[].ipfsId IPFS ID of the relay
   * @apiSuccess {String} relays.v2Relays[].name Name of the relay (hydrated from peer data)
   * @apiSuccess {String} relays.v2Relays[].description Description of the relay (hydrated from peer data)
   * @apiSuccess {Object[]} relays.v1Relays Array of v1 Circuit Relay configurations
   */
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

  /**
   * @api {post} /ipfs/connect Connect to a specific IPFS peer
   * @apiPermission public
   * @apiName ConnectToIpfsPeer
   * @apiGroup REST IPFS
   *
   * @apiDescription Attempts to establish a connection to a specific IPFS peer using the provided multiaddr. Optionally returns detailed information about the connection.
   *
   * @apiParam {String} multiaddr Multiaddress of the peer to connect to (required)
   * @apiParam {Boolean} [getDetails=false] Whether to return detailed connection information
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X POST localhost:5001/ipfs/connect \
   *   -d '{"multiaddr": "/ip4/161.35.99.207/tcp/4001/p2p/12D3KooWDtj9cfj1SKuLbDNKvKRKSsGN8qivq9M8CYpLPDpcD5pu", "getDetails": false}'
   *
   * @apiSuccess {Boolean} success Indicates whether the connection attempt was successful
   * @apiSuccess {Object} [details] Additional connection details (when getDetails=true)
   */
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

  /**
   * @api {post} /ipfs/upload Upload a file to IPFS
   * @apiPermission public
   * @apiName UploadFileToIpfs
   * @apiGroup REST IPFS
   *
   * @apiDescription Upload a file via HTTP multipart form data and add it to the IPFS node. The file will be stored in the IPFS network and a CID (Content Identifier) will be returned.
   *
   * @apiParam {File} file File to upload (required, multipart form data)
   *
   * @apiExample Example usage:
   * curl -X POST -F "file=@/path/to/your/file.txt" localhost:5001/ipfs/upload
   *
   * @apiSuccess {String} cid Content Identifier (CID) of the uploaded file
   * @apiSuccess {String} hash Hash of the uploaded file
   * @apiSuccess {Number} size Size of the uploaded file in bytes
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "cid": "bafybeidhiave6yci6gih6ixv5dp63p2qsgfxei4fwg77fov45qezewlpgq",
   *       "hash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
   *       "size": 1024
   *     }
   *
   * @apiError UnprocessableEntity Missing or invalid file parameter
   * @apiError InternalServerError Error uploading file to IPFS
   *
   * @apiErrorExample {json} Error-Response:
   *     HTTP/1.1 422 Unprocessable Entity
   *     {
   *       "status": 422,
   *       "error": "Unprocessable Entity"
   *     }
   */
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

  /**
   * @api {get} /ipfs/stat/:cid Get statistics for a CID
   * @apiPermission public
   * @apiName GetIpfsStat
   * @apiGroup REST IPFS
   *
   * @apiDescription Get statistics and metadata for a specific Content Identifier (CID) in the IPFS network. This endpoint provides information about the file or data associated with the given CID.
   *
   * @apiParam {String} cid Content Identifier (CID) to get statistics for (required, URL parameter)
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5001/ipfs/stat/bafybeidhiave6yci6gih6ixv5dp63p2qsgfxei4fwg77fov45qezewlpgq
   *
   * @apiSuccess {String} cid Content Identifier
   * @apiSuccess {Number} size Size of the data in bytes
   * @apiSuccess {Number} cumulativeSize Cumulative size including all blocks
   * @apiSuccess {Number} blocks Number of blocks in the data
   * @apiSuccess {String} type Type of the data (file, directory, etc.)
   * @apiSuccess {Boolean} withLocality Whether locality information is available
   * @apiSuccess {Number} local Whether the data is stored locally
   * @apiSuccess {Number} sizeLocal Size of locally stored data
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "cid": "bafybeidhiave6yci6gih6ixv5dp63p2qsgfxei4fwg77fov45qezewlpgq",
   *       "size": 1024,
   *       "cumulativeSize": 2048,
   *       "blocks": 5,
   *       "type": "file",
   *       "withLocality": false,
   *       "local": 1024,
   *       "sizeLocal": 1024
   *     }
   *
   * @apiError NotFound CID not found or invalid
   * @apiError InternalServerError Error retrieving CID statistics
   *
   * @apiErrorExample {json} Error-Response:
   *     HTTP/1.1 404 Not Found
   *     {
   *       "status": 404,
   *       "error": "Not Found"
   *     }
   */
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
   * curl -H "Content-Type: application/json" -X POST \
   * -d '{ "address": "bitcoincash:qq0jhnhd8wjjfx0295vafhku3vj9s5j3zcfcg2zlyn", \
   * "cid": "bafybeidhiave6yci6gih6ixv5dp63p2qsgfxei4fwg77fov45qezewlpgq", \
   * "filename": "test.txt" }' localhost:5040/ipfs/createPinClaim
   *
   */
  async createPinClaim (ctx) {
    try {
      const { address, cid, filename } = ctx.request.body

      const result = await this.useCases.ipfs.createPinClaim({ address, cid, filename })

      ctx.body = result
    } catch (err) {
      console.error('Error in ipfs/controller.js/createPinClaim(): ', err)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {post} /ipfs/getBchCost Get the cost in BCH to write a file to the network.
   * @apiPermission public
   * @apiName getBchCost
   * @apiGroup REST BCH
   * @apiDescription Get the cost in BCH to write a file to the network.
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X POST -d '{ "sizeInMb": 1 }' localhost:5040/ipfs/getBchCost
   *
   */
  async getBchCost (ctx) {
    try {
      const { sizeInMb } = ctx.request.body

      const result = await this.useCases.ipfs.getBchCost({ sizeInMb })

      ctx.body = result
    } catch (err) {
      console.error('Error in ipfs/controller.js/getBchCost(): ', err)
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
