/* eslint-env mocha */
import { assert } from 'chai'
import config from '../../../config/index.js'
import {
  buildX402Routes,
  getX402WellKnownManifest,
  getX402AgentAuthPricing,
  createAuthHeader,
  getFacilitatorHttpUrl,
  resolvePrimaryFacilitatorKey,
  getActiveFacilitatorKeys,
  getFacilitatorConnectionOptions,
  getFacilitatorConfig,
  facilitatorRequiresAuth
} from '../../../src/config/x402.js'

const GOOD = '0x' + 'a'.repeat(40)
const GOOD_ALT = '0x' + 'b'.repeat(40)

// Test-only EC P-256 private key (PEM) — offline JWT signing in createAuthHeader test
const CDP_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgqllTDugrtjsHNpS/
1iR7u62qfYd5uaiwaVHSH0aKeAyhRANCAAS/32h8nwrbmgACPRZKaA5xRSGtBFYd
9iN6jdR7aM918Ext/D5p3K5rhTddVWmzIg7VqUEsFP3WSMULeqvInrvo
-----END PRIVATE KEY-----`

describe('#x402 buildX402Routes / manifest / getX402AgentAuthPricing / createAuthHeader', () => {
  let origX402
  let origApiPrefix
  let origConsoleLog
  let savedPrimary, savedActive, savedPayai

  beforeEach(() => {
    origX402 = { ...config.x402 }
    origApiPrefix = config.apiPrefix
    origConsoleLog = console.log
    savedPrimary = process.env.PRIMARY_FACILITATOR
    savedActive = process.env.ACTIVE_FACILITATORS
    savedPayai = process.env.PAYAI_FACILITATOR_URL
    console.log = () => {}
  })

  afterEach(() => {
    config.x402 = origX402
    config.apiPrefix = origApiPrefix
    console.log = origConsoleLog
    if (savedPrimary === undefined) delete process.env.PRIMARY_FACILITATOR
    else process.env.PRIMARY_FACILITATOR = savedPrimary
    if (savedActive === undefined) delete process.env.ACTIVE_FACILITATORS
    else process.env.ACTIVE_FACILITATORS = savedActive
    if (savedPayai === undefined) delete process.env.PAYAI_FACILITATOR_URL
    else process.env.PAYAI_FACILITATOR_URL = savedPayai
  })

  it('buildX402Routes returns a route with exact accepts', () => {
    config.x402 = {
      ...origX402,
      network: 'eip155:8453',
      serverAddress: GOOD,
      priceUSDC: 0.1,
      bazaarEnabled: false
    }
    config.apiPrefix = '/ipfs'
    const routes = buildX402Routes('/ipfs')
    const key = Object.keys(routes)[0]
    const entry = routes[key]
    assert.isArray(entry.accepts)
    assert.equal(entry.accepts[0].scheme, 'exact')
    assert.equal(entry.accepts[0].payTo, GOOD)
  })

  it('buildX402Routes with bazaarEnabled adds extensions', () => {
    config.x402 = {
      ...origX402,
      network: 'eip155:8453',
      serverAddress: GOOD,
      priceUSDC: 0.1,
      bazaarEnabled: true
    }
    const routes = buildX402Routes('/ipfs')
    const key = Object.keys(routes)[0]
    const entry = routes[key]
    assert.isDefined(entry.extensions)
  })

  it('buildX402Routes throws when network missing', () => {
    config.x402 = { ...origX402, network: '', serverAddress: GOOD, priceUSDC: 0.1, bazaarEnabled: false }
    assert.throws(() => buildX402Routes('/ipfs'), /network is required/)
  })

  it('buildX402Routes throws when payTo missing', () => {
    config.x402 = { ...origX402, network: 'eip155:8453', serverAddress: '', priceUSDC: 0.1, bazaarEnabled: false }
    assert.throws(() => buildX402Routes('/ipfs'), /SERVER_BASE_ADDRESS/)
  })

  it('buildX402Routes throws on invalid EVM payTo', () => {
    config.x402 = {
      ...origX402,
      network: 'eip155:8453',
      serverAddress: 'not-an-address',
      priceUSDC: 0.1,
      bazaarEnabled: false
    }
    assert.throws(() => buildX402Routes(), /0x-prefixed/)
  })

  it('getX402WellKnownManifest returns v2 resource shape', () => {
    config.x402 = {
      ...origX402,
      network: 'eip155:8453',
      serverAddress: GOOD_ALT,
      priceUSDC: 0.05,
      facilitatorUrl: 'https://facilitator.test/x402'
    }
    const m = getX402WellKnownManifest('/ipfs')
    assert.equal(m.x402Version, 2)
    assert.equal(m.resources[0].resource, '/ipfs/*')
  })

  it('getX402AgentAuthPricing returns null when x402 disabled', () => {
    config.x402 = { ...origX402, enabled: false, serverAddress: GOOD, network: 'eip155:8453' }
    assert.isNull(getX402AgentAuthPricing())
  })

  it('getX402AgentAuthPricing returns null for invalid EVM address', () => {
    config.x402 = { ...origX402, enabled: true, serverAddress: 'nope', network: 'eip155:8453' }
    assert.isNull(getX402AgentAuthPricing())
  })

  it('getX402AgentAuthPricing returns object when valid', () => {
    config.x402 = {
      ...origX402,
      enabled: true,
      serverAddress: GOOD,
      network: 'eip155:8453',
      priceUSDC: 0.2,
      facilitatorUrl: 'https://f.test'
    }
    const p = getX402AgentAuthPricing()
    assert.isObject(p)
    assert.equal(p.payTo, GOOD)
  })

  it('createAuthHeader returns empty headers when CDP keys missing', async () => {
    config.x402 = {
      ...origX402,
      facilitatorKeyId: '',
      facilitatorSecretKey: ''
    }
    const h = await createAuthHeader()
    assert.deepEqual(h.verify, {})
    assert.deepEqual(h.settle, {})
    assert.deepEqual(h.supported, {})
  })

  it('getFacilitatorHttpUrl returns dexter, payai, and cdp default URLs', () => {
    process.env.PAYAI_FACILITATOR_URL = 'https://custom.payai.example/'
    assert.equal(getFacilitatorHttpUrl('dexter').includes('dexter.cash'), true)
    assert.equal(getFacilitatorHttpUrl('payai'), 'https://custom.payai.example')
    assert.equal(getFacilitatorHttpUrl('cdp').includes('cdp.coinbase.com'), true)
  })

  it('resolvePrimaryFacilitatorKey maps unknowns to cdp and honors env', () => {
    process.env.PRIMARY_FACILITATOR = 'nope'
    assert.equal(resolvePrimaryFacilitatorKey(), 'cdp')
    process.env.PRIMARY_FACILITATOR = 'dexter'
    assert.equal(resolvePrimaryFacilitatorKey(), 'dexter')
  })

  it('resolvePrimary uses default cdp when env empty and x402.primaryFacilitator is empty', () => {
    delete process.env.PRIMARY_FACILITATOR
    const prev = config.x402
    config.x402 = { ...origX402, primaryFacilitator: '' }
    assert.equal(resolvePrimaryFacilitatorKey(), 'cdp')
    config.x402 = prev
  })

  it('getActiveFacilitatorKeys falls back, filters, and reorders by primary', () => {
    delete process.env.ACTIVE_FACILITATORS
    const one = getActiveFacilitatorKeys()
    assert.isArray(one)
    process.env.ACTIVE_FACILITATORS = 'nope,cdp,cdp'
    assert.deepEqual(getActiveFacilitatorKeys(), ['cdp'])
    process.env.ACTIVE_FACILITATORS = 'cdp,dexter'
    const two = getActiveFacilitatorKeys()
    assert.deepEqual(two, ['cdp', 'dexter'])
    process.env.ACTIVE_FACILITATORS = 'nope,foo'
    const fallback = getActiveFacilitatorKeys()
    assert.deepEqual(fallback, [resolvePrimaryFacilitatorKey()])
  })

  it('getFacilitatorConnectionOptions uses per-facilitator URL when several active', () => {
    process.env.ACTIVE_FACILITATORS = 'cdp,dexter'
    const opts = getFacilitatorConnectionOptions()
    assert.isAtLeast(opts.length, 2)
    const dex = opts.find(o => o.key === 'dexter')
    assert.isDefined(dex)
    assert.equal(dex.url, 'https://x402.dexter.cash')
  })

  it('getFacilitatorConfig and facilitatorRequiresAuth return sensible defaults', () => {
    const c = getFacilitatorConfig('nope')
    assert.equal(c.name, 'Coinbase CDP')
    assert.equal(facilitatorRequiresAuth('cdp'), true)
    assert.equal(facilitatorRequiresAuth('dexter'), false)
    assert.equal(facilitatorRequiresAuth('not-a-facilitator'), false)
  })

  it('getX402WellKnownManifest throws when network missing', () => {
    config.x402 = { ...origX402, network: '', serverAddress: GOOD, priceUSDC: 0.1, facilitatorUrl: 'https://f' }
    assert.throws(() => getX402WellKnownManifest('/ipfs'), /network is required/)
  })

  it('createAuthHeader returns bearer headers when CDP key material is valid PEM', async () => {
    config.x402 = {
      ...origX402,
      facilitatorKeyId: 'id-test',
      facilitatorSecretKey: CDP_PEM
    }
    const h = await createAuthHeader()
    assert.equal(h.verify.Authorization.slice(0, 7), 'Bearer ')
    assert.equal(h.settle.Authorization.slice(0, 7), 'Bearer ')
    assert.equal(h.supported.Authorization.slice(0, 7), 'Bearer ')
  })
})
