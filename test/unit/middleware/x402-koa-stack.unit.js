/* eslint-env mocha */
import { assert } from 'chai'
import { applyX402KoaStack } from '../../../src/middleware/x402-koa-stack.js'
import config from '../../../config/index.js'

const GOOD = '0x' + 'c'.repeat(40)

describe('#applyX402KoaStack', () => {
  let prevSvcEnv
  let origX402
  let origApiPrefix

  beforeEach(() => {
    prevSvcEnv = process.env.SVC_ENV
    process.env.SVC_ENV = 'development'
    origX402 = { ...config.x402 }
    origApiPrefix = config.apiPrefix
    config.x402 = {
      ...origX402,
      enabled: true,
      network: 'eip155:8453',
      serverAddress: GOOD,
      priceUSDC: 0.01,
      bazaarEnabled: false,
      facilitatorUrl: 'https://x402.dexter.cash'
    }
    config.apiPrefix = '/ipfs'
  })

  afterEach(() => {
    if (prevSvcEnv === undefined) delete process.env.SVC_ENV
    else process.env.SVC_ENV = prevSvcEnv
    config.x402 = origX402
    config.apiPrefix = origApiPrefix
  })

  it('registers middleware when x402 enabled and not test', () => {
    const useCalls = []
    const app = {
      use: (fn) => {
        useCalls.push(fn)
      }
    }
    applyX402KoaStack(app, { config: { ...config, env: 'development' } })
    assert.isAtLeast(useCalls.length, 1, 'should register bridge + koaConnect middleware')
  })

  it('no-op when env is test', () => {
    const useCalls = []
    const app = { use: (fn) => useCalls.push(fn) }
    applyX402KoaStack(app, { config: { ...config, env: 'test' } })
    assert.lengthOf(useCalls, 0)
  })

  it('no x402 middleware when X402 disabled (only info path)', () => {
    const useCalls = []
    const app = { use: (fn) => useCalls.push(fn) }
    config.x402 = { ...config.x402, enabled: false }
    applyX402KoaStack(app, { config: { ...config, env: 'development' } })
    assert.lengthOf(useCalls, 0)
  })
})
