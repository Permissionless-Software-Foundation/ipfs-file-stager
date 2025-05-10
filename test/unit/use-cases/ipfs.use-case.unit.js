/*
Unit tests for the use-cases/ipfs-use-case.js  business logic library.

*/

// Public npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local support libraries
import adapters from '../mocks/adapters/index.js'

// Unit under test (uut)
import IpfsUseCase from '../../../src/use-cases/ipfs-use-cases.js'

describe('#ipfs-use-case', () => {
  let uut
  let sandbox

  before(async () => {

  })

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new IpfsUseCase({ adapters })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters are not passed in', () => {
      try {
        uut = new IpfsUseCase()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of adapters must be passed in when instantiating IPFS Use Cases library.'
        )
      }
    })
  })

  describe('#getPaymentAddr', () => {
    it('should get paymentAddr', async () => {
      sandbox.stub(uut, 'getBchCost').resolves(1)
      sandbox.stub(uut.adapters.wallet, 'getKeyPair').resolves({})
      const result = await uut.getPaymentAddr({ sizeInMb: 1 })

      assert.isObject(result)
      assert.property(result, 'address')
      assert.property(result, 'bchCost')
    })

    it('should handle efectiveSize ', async () => {
      sandbox.stub(uut, 'getBchCost').resolves(1)
      sandbox.stub(uut.adapters.wallet, 'getKeyPair').resolves({})
      const result = await uut.getPaymentAddr({ sizeInMb: 0.1 })

      assert.isObject(result)
      assert.property(result, 'address')
      assert.property(result, 'bchCost')
    })

    it('should handle error', async () => {
      try {
        // Force an error
        sandbox.stub(uut, 'getBchCost').throws(new Error('uut error'))

        await uut.getPaymentAddr({ sizeInMb: 1 })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'uut error')
      }
    })
  })

  describe('#getBchCost', () => {
    it('should get getBchCost', async () => {
      sandbox.stub(uut.axios, 'get').resolves({ data: { usdPerBCH: 1, usdPerToken: 1 } })
      sandbox.stub(uut.adapters.wallet.bchWallet, 'getPsfWritePrice').resolves(1)
      const result = await uut.getBchCost({ sizeInMb: 1 })

      assert.isNumber(result)
    })
    it('should handle efectiveSize', async () => {
      sandbox.stub(uut.axios, 'get').resolves({ data: { usdPerBCH: 1, usdPerToken: 1 } })
      sandbox.stub(uut.adapters.wallet.bchWallet, 'getPsfWritePrice').resolves(1)
      const result = await uut.getBchCost({ sizeInMb: 0.1 })

      assert.isNumber(result)
    })

    it('should handle error', async () => {
      try {
        // Force an error
        sandbox.stub(uut.axios, 'get').throws(new Error('uut error'))

        await uut.getBchCost({ sizeInMb: 1 })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'uut error')
      }
    })
  })
})
