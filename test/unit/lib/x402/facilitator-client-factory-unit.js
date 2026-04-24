/* eslint-env mocha */
import { assert } from 'chai'
import { createFacilitatorClient } from '../../../../src/lib/x402/facilitator-client-factory.js'
import { RoundRobinFacilitatorClient } from '../../../../src/lib/x402/round-robin-facilitator-client.js'

class FakeFacilitatorClient {
  constructor (opts) {
    this.opts = opts
  }
}

describe('#facilitator-client-factory', () => {
  it('throws when no connection options are provided', () => {
    assert.throws(
      () => createFacilitatorClient([], () => ({}), FakeFacilitatorClient),
      /No facilitator connection options/
    )
  })

  it('exposes working verify, settle, and getSupported for single client', async () => {
    class C {
      constructor (opts) {
        this.opts = opts
      }

      getSupported () {
        return { kinds: [] }
      }

      async verify (a, b) {
        return { ok: 1, a, b }
      }

      async settle (a, b) {
        return { transaction: '0xabc', a, b }
      }
    }
    const { client } = createFacilitatorClient(
      [{ key: 'x', name: 'n', url: 'https://x.example', requiresAuth: false }],
      () => ({}),
      C
    )
    const g = await client.getSupported()
    assert.isArray(g.kinds)
    const v = await client.verify(1, 2)
    assert.equal(v.ok, 1)
    const s = await client.settle(1, 2)
    assert.equal(s.transaction, '0xabc')
  })

  it('returns single strategy when only one facilitator is configured', () => {
    const connectionOpts = [
      { key: 'cdp', name: 'Coinbase CDP', url: 'https://cdp.example.com', requiresAuth: true }
    ]

    const result = createFacilitatorClient(connectionOpts, async () => ({}), FakeFacilitatorClient)

    assert.equal(result.strategy, 'single')
    assert.isFunction(result.client.verify)
    assert.isFunction(result.client.settle)
    assert.isFunction(result.client.getSupported)
  })

  it('returns round-robin strategy when multiple facilitators are configured', () => {
    const connectionOpts = [
      { key: 'cdp', name: 'Coinbase CDP', url: 'https://cdp.example.com', requiresAuth: true },
      { key: 'dexter', name: 'Dexter', url: 'https://dexter.example.com', requiresAuth: false }
    ]

    const result = createFacilitatorClient(connectionOpts, async () => ({}), FakeFacilitatorClient)

    assert.equal(result.strategy, 'round-robin-failover')
    assert.instanceOf(result.client, RoundRobinFacilitatorClient)
    assert.lengthOf(result.client.entries, 2)
    assert.equal(result.client.entries[0].key, 'cdp')
    assert.equal(result.client.entries[1].key, 'dexter')
  })
})
