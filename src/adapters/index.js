/*
  This is a top-level library that encapsulates all the additional Adapters.
  The concept of Adapters comes from Clean Architecture:
  https://troutsblog.com/blog/clean-architecture
*/

// Public NPM libraries
import BCHJS from '@psf/bch-js'

// Load individual adapter libraries.
import IPFSAdapter from './ipfs/index.js'
import LocalDB from './localdb/index.js'
import LogsAPI from './logapi.js'
import Passport from './passport.js'
import Nodemailer from './nodemailer.js'
// const { wlogger } = require('./wlogger')
import JSONFiles from './json-files.js'
import FullStackJWT from './fullstack-jwt.js'
import config from '../../config/index.js'
import Wallet from './wallet.adapter.js'

class Adapters {
  constructor (localConfig = {}) {
    // Encapsulate dependencies
    this.ipfs = new IPFSAdapter()
    this.localdb = new LocalDB()
    this.logapi = new LogsAPI()
    this.passport = new Passport()
    this.nodemailer = new Nodemailer()
    this.jsonFiles = new JSONFiles()
    this.bchjs = new BCHJS()
    this.config = config
    this.wallet = new Wallet(localConfig)

    // Get a valid JWT API key and instance bch-js.
    this.fullStackJwt = new FullStackJWT(config)
  }

  async start () {
    try {
      let apiToken
      if (this.config.getJwtAtStartup) {
        // Get a JWT token and instantiate bch-js with it. Then pass that instance
        // to all the rest of the apps controllers and adapters.
        apiToken = await this.fullStackJwt.getJWT()
        // Instantiate bch-js with the JWT token, and overwrite the placeholder for bch-js.
        this.bchjs = await this.fullStackJwt.instanceBchjs()
      }

      // Load the wallet from the file.
      const walletData = await this.wallet.openWallet()
      // console.log('walletData: ', walletData)

      // Create a default instance of minimal-slp-wallet without initializing it
      // (without retrieving the wallets UTXOs). This instance will be overwritten
      // if the operator has configured BCH payments.
      // console.log('\nCreating default startup wallet. This wallet may be overwritten.')
      await this.wallet.instanceWallet(walletData, { apiToken })
      this.bchjs = this.wallet.bchWallet.bchjs
      // console.log('this.wallet.bchWallet.walletInfo: ', this.wallet.bchWallet.walletInfo)

      // Start the IPFS node.
      // Do not start these adapters if this is an e2e test.
      if (this.config.env !== 'test') {
        if (this.config.useIpfs) {
          await this.ipfs.start()
        }
      } else {
        // These lines are here to ensure code coverage hits 100%.
        console.log('Not starting IPFS node since this is an e2e test.')
      }

      console.log('Async Adapters have been started.')

      return true
    } catch (err) {
      console.error('Error in adapters/index.js/start()')
      throw err
    }
  }
}

export default Adapters
