/*
Unit tests for the use-cases/ipfs-use-case.js  business logic library.

*/

// Public npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local support libraries
import adapters from '../mocks/adapters/index.js'
import BchTokenSweepMock from '../mocks/bch-token-sweep-mock.js'
import PSFFPPMock from '../mocks/psffpp-mock.js'
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
    uut.BchTokenSweep = BchTokenSweepMock.BchTokenSweepMock
    uut.PSFFPP = PSFFPPMock.PSFFPPMock
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

  describe('#upload', () => {
    it('should upload a file', async () => {
      const fileMock = {
        originalFilename: 'test.txt',
        size: 100,
        filepath: 'test.txt'
      }
      sandbox.stub(uut.fs, 'createReadStream').returns('content')
      const result = await uut.upload({ file: fileMock })

      assert.isObject(result)
      assert.property(result, 'success')
      assert.property(result, 'cid')

      assert.equal(uut.cids.length, 1)
      assert.equal(uut.cids[0].cid, result.cid)
      assert.isString(uut.cids[0].timestamp)
    })

    it('should handle error if file size is too large', async () => {
      try {
        const fileMock = {
          originalFilename: 'test.txt',
          size: 100000000 + 1,
          filepath: 'test.txt'
        }
        await uut.upload({ file: fileMock })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'File exceeds max file size of 100000000')
      }
    })
    it('should handle ipfs addFile error', async () => {
      try {
        sandbox.stub(uut.fs, 'createReadStream').returns('content')
        sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'addFile').throws(new Error('ipfs error'))
        const fileMock = {
          originalFilename: 'test.txt',
          size: 1000,
          filepath: 'test.txt'
        }
        await uut.upload({ file: fileMock })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'ipfs error')
      }
    })
  })

  describe('#stat', () => {
    it('should get cid stats', async () => {
      const result = await uut.stat({ cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m' })

      assert.isObject(result)
      assert.property(result, 'fileSize')
      assert.property(result, 'cid')
    })

    it('should handle  ipfs error', async () => {
      try {
        sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'stat').throws(new Error('ipfs error'))
        await uut.stat({ cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m' })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'ipfs error')
      }
    })
  })
  describe('#clearStagedFiles', () => {
    it('should clear staged files', async () => {
      const spy = sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'rm').resolves()
      const aDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000) + 1

      uut.cids = [
        { cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m', timestamp: aDayAgo },
        { cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m', timestamp: new Date() }

      ]
      const result = await uut.clearStagedFiles()

      assert.isTrue(result)
      assert.isTrue(spy.called)
      assert.equal(uut.cids.length, 1)
    })

    it('should ignore ipfs rm() error', async () => {
      const spy = sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'rm').throws(new Error('ipfs error'))
      const aDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000) + 1
      uut.cids = [{ cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m', timestamp: aDayAgo }]
      const result = await uut.clearStagedFiles()

      assert.isTrue(result)
      assert.isTrue(spy.called)
      assert.equal(uut.cids.length, 0, 'CID should be deleted even on ipfs rm error')
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

  describe('#createPinClaim', () => {
    it('should create pin claim', async () => {
      const inObj = {
        address: 'bchaddress: 0000...',
        cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m',
        filename: 'test.txt'
      }
      const saveSpy = sandbox.spy()
      sandbox.stub(uut.adapters.localdb.BchPayment, 'findOne').resolves({ save: saveSpy })
      sandbox.stub(uut.adapters.wallet.bchWallet, 'getBalance').resolves(1)
      sandbox.stub(uut.adapters.wallet.bchWallet.ar, 'sendTx').resolves('txid')
      const result = await uut.createPinClaim(inObj)

      assert.isObject(result)
      assert.property(result, 'pobTxid')
      assert.property(result, 'claimTxid')
      assert.isTrue(saveSpy.called)
    })
    it('should handle error if payment model is not found', async () => {
      try {
        const inObj = {
          address: 'bchaddress: 0000...',
          cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m',
          filename: 'test.txt'
        }
        // Force an error
        sandbox.stub(uut.adapters.localdb.BchPayment, 'findOne').resolves(null)

        await uut.createPinClaim(inObj)

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'not found in database')
      }
    })
    it('should handle insufficient balance', async () => {
      try {
        const inObj = {
          address: 'bchaddress: 0000...',
          cid: 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m',
          filename: 'test.txt'
        }
        // Force an error
        sandbox.stub(uut.adapters.localdb.BchPayment, 'findOne').resolves({ save: () => {}, bchCost: 1 })
        sandbox.stub(uut.adapters.wallet.bchWallet, 'getBalance').resolves(0)

        await uut.createPinClaim(inObj)

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'insufficient balance')
      }
    })
  })
})
