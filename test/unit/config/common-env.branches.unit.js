/* eslint-env mocha */
import { assert } from 'chai'

describe('#config/env/common branches (dynamic import)', () => {
  const keys = [
    'X402_ENABLED', 'X402_BAZAAR_ENABLED', 'X402_NETWORK', 'x402_FACILITATOR_URL',
    'PRIMARY_FACILITATOR', 'PAYAI_FACILITATOR_URL', 'X402_PRICE_USDC'
  ]

  afterEach(() => {
    for (const k of keys) delete process.env[k]
  })

  const load = async (bust) => {
    const mod = await import(`../../../config/env/common.js?test=${bust}`)
    return mod.default
  }

  it('normalizeBoolean handles true/false strings and empty', async () => {
    process.env.X402_ENABLED = 'true'
    process.env.X402_BAZAAR_ENABLED = 'false'
    const c = await load('bool-1')
    assert.equal(c.x402.enabled, true)
    assert.equal(c.x402.bazaarEnabled, false)
  })

  it('normalizeBoolean returns default for unrecognized strings', async () => {
    process.env.X402_ENABLED = 'maybe'
    const c = await load('bool-unk')
    assert.equal(c.x402.enabled, false)
  })

  it('toV2Caip2Network maps base, base-sepolia, and passthrough eip155', async () => {
    process.env.X402_NETWORK = 'base'
    const a = await load('net-base')
    assert.equal(a.x402.network, 'eip155:8453')
    process.env.X402_NETWORK = 'base-sepolia'
    const b = await load('net-sep')
    assert.equal(b.x402.network, 'eip155:84532')
    process.env.X402_NETWORK = 'eip155:999'
    const c = await load('net-custom')
    assert.equal(c.x402.network, 'eip155:999')
  })

  it('toV2Caip2Network returns raw string for non-eip155 networks', async () => {
    process.env.X402_NETWORK = 'custom-network-id'
    const c = await load('net-raw')
    assert.equal(c.x402.network, 'custom-network-id')
  })

  it('resolveX402FacilitatorUrl uses explicit x402_FACILITATOR_URL and dexter primary', async () => {
    process.env.x402_FACILITATOR_URL = 'https://explicit.example/x402/'
    process.env.PRIMARY_FACILITATOR = 'cdp'
    const c = await load('fac-explicit')
    assert.equal(c.x402.facilitatorUrl, 'https://explicit.example/x402')
    delete process.env.x402_FACILITATOR_URL
    process.env.PRIMARY_FACILITATOR = 'dexter'
    const d = await load('fac-dex')
    assert.equal(d.x402.facilitatorUrl, 'https://x402.dexter.cash')
  })

  it('payai primary uses PAYAI_FACILITATOR_URL when set', async () => {
    process.env.PRIMARY_FACILITATOR = 'payai'
    process.env.PAYAI_FACILITATOR_URL = 'https://pay.example/custom/'
    const c = await load('fac-pay')
    assert.equal(c.x402.facilitatorUrl, 'https://pay.example/custom')
    delete process.env.PAYAI_FACILITATOR_URL
    const d = await load('fac-pay-def')
    assert.equal(d.x402.facilitatorUrl.includes('payai'), true)
  })

  it('primaryFacilitator falls back to cdp for unknown key', async () => {
    process.env.PRIMARY_FACILITATOR = 'not-a-real-key'
    const c = await load('pri-1')
    assert.equal(c.x402.primaryFacilitator, 'cdp')
  })

  it('X402_PRICE_USDC uses default when invalid or missing', async () => {
    delete process.env.X402_PRICE_USDC
    const a = await load('price-def')
    assert.equal(a.x402.priceUSDC, 0.1)
    process.env.X402_PRICE_USDC = 'not-a-number'
    const b = await load('price-nan')
    assert.equal(b.x402.priceUSDC, 0.1)
  })
})
