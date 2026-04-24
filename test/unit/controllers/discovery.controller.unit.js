/* eslint-env mocha */
import { assert } from 'chai'
import DiscoveryController from '../../../src/controllers/discovery/controller.js'

describe('#DiscoveryController', () => {
  it('x402Manifest: 404 when x402 disabled', async () => {
    const c = new DiscoveryController({
      getX402Settings: () => ({ enabled: false }),
      getX402WellKnownManifest: () => ({}),
      apiPrefix: '/ipfs'
    })
    const ctx = { status: null, body: null }
    await c.x402Manifest(ctx)
    assert.equal(ctx.status, 404)
    assert.deepEqual(ctx.body, { error: 'Not found' })
  })

  it('x402Manifest: 200 with manifest from helper', async () => {
    const manifest = { x402Version: 2, test: true }
    const c = new DiscoveryController({
      getX402Settings: () => ({ enabled: true }),
      getX402WellKnownManifest: (prefix) => {
        assert.equal(prefix, '/ipfs')
        return manifest
      },
      apiPrefix: '/ipfs'
    })
    const ctx = { body: null }
    await c.x402Manifest(ctx)
    assert.deepEqual(ctx.body, manifest)
  })

  it('x402Manifest: 500 when manifest helper throws', async () => {
    const c = new DiscoveryController({
      getX402Settings: () => ({ enabled: true }),
      getX402WellKnownManifest: () => {
        throw new Error('bad config')
      },
      apiPrefix: '/ipfs'
    })
    const ctx = { status: null, body: null }
    await c.x402Manifest(ctx)
    assert.equal(ctx.status, 500)
    assert.equal(ctx.body.error, 'x402 configuration error')
    assert.include(ctx.body.message, 'bad config')
  })
})
