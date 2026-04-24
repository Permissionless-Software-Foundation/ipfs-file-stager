import config from '../../../config/index.js'
import wlogger from '../../adapters/wlogger.js'
import { getX402Settings, getX402WellKnownManifest as defaultGetX402WellKnownManifest } from '../../config/x402.js'

class DiscoveryController {
  constructor (localConfig = {}) {
    this.getX402Settings = localConfig.getX402Settings || getX402Settings
    this.getX402WellKnownManifest =
      localConfig.getX402WellKnownManifest || defaultGetX402WellKnownManifest
    this.apiPrefix = localConfig.apiPrefix || config.apiPrefix

    this.x402Manifest = this.x402Manifest.bind(this)
  }

  async x402Manifest (ctx) {
    const { enabled } = this.getX402Settings()
    if (!enabled) {
      ctx.status = 404
      ctx.body = { error: 'Not found' }
      return
    }

    const apiPrefix = this.apiPrefix || '/ipfs'
    try {
      ctx.body = this.getX402WellKnownManifest(apiPrefix)
    } catch (err) {
      wlogger.error('x402 well-known manifest error:', err)
      ctx.status = 500
      ctx.body = {
        error: 'x402 configuration error',
        message: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

export default DiscoveryController
