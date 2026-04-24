import Router from 'koa-router'
import DiscoveryController from './controller.js'

class DiscoveryKoaRouter {
  constructor (localConfig = {}) {
    this.controller = new DiscoveryController(localConfig)
  }

  attach (app) {
    if (!app) {
      throw new Error('Must pass Koa app when attaching DiscoveryKoaRouter.')
    }

    const r = new Router()
    r.get('/.well-known/x402', this.controller.x402Manifest)
    r.get('/.well-known/x402.json', this.controller.x402Manifest)

    app.use(r.routes())
    app.use(r.allowedMethods())
  }
}

export default DiscoveryKoaRouter
