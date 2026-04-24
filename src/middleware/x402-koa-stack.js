/*
  Wires @x402/express (Connect-style) into Koa via koa-connect, matching psf-bch-api-base behavior.
*/

import koaConnect from 'koa-connect'
import { paymentMiddleware as x402PaymentMiddleware } from '@x402/express'
import { x402ResourceServer } from '@x402/core/server'
import { registerExactEvmScheme } from '@x402/evm/exact/server'

import wlogger from '../adapters/wlogger.js'
import { x402ExpressReqBridge } from './x402-req-bridge.js'
import {
  buildX402Routes,
  getX402Settings,
  createAuthHeader,
  getFacilitatorConnectionOptions
} from '../config/x402.js'
import { createFacilitatorClient } from '../lib/x402/facilitator-client-factory.js'

export function applyX402KoaStack (app, opts) {
  const cfg = opts.config
  const x402Settings = getX402Settings()
  const isTest = cfg.env === 'test' || process.env.SVC_ENV === 'test'

  if (isTest) {
    wlogger.info('x402 middleware skipped in test environment')
    return
  }

  if (x402Settings.enabled) {
    app.use(x402ExpressReqBridge())

    const routes = buildX402Routes(cfg.apiPrefix)
    const connectionOpts = getFacilitatorConnectionOptions()
    const facilitator = createFacilitatorClient(connectionOpts, createAuthHeader)

    wlogger.info(
      `x402 v2 middleware enabled; ${x402Settings.priceUSDC} USDC per request under ${cfg.apiPrefix} [facilitators: ${connectionOpts.map(o => o.name).join(', ')}] [settle: ${facilitator.strategy}]`
    )

    // eslint-disable-next-line new-cap
    const resourceServer = new x402ResourceServer(facilitator.client)
    registerExactEvmScheme(resourceServer, {})
    app.use(koaConnect(x402PaymentMiddleware(routes, resourceServer)))

    console.log(`Facilitator(s): ${connectionOpts.map(o => `${o.name} → ${o.url}`).join(' | ')}`)
  } else {
    wlogger.info('x402 middleware disabled (X402_ENABLED not set)')
  }
}
