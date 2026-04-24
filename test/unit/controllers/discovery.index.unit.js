/* eslint-env mocha */
import { assert } from 'chai'
import DiscoveryKoaRouter from '../../../src/controllers/discovery/index.js'

describe('#DiscoveryKoaRouter', () => {
  it('attach throws if app is missing', () => {
    const r = new DiscoveryKoaRouter()
    assert.throws(() => r.attach(), /Must pass Koa app when attaching/)
  })
})
