/*
Unit tests for the use-cases/ipfs-use-case.js  business logic library.

*/

// Public npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local support libraries
import adapters from '../mocks/adapters/index.js'
import PSFFPPMock from '../mocks/psffpp-mock.js'
// Unit under test (uut)
import IpfsUseCase from '../../../src/use-cases/ipfs-use-cases.js'

// Fixtures for the BCH payment path (PS010 v2.0.0).
const PAYOUT_ADDRESS = 'bitcoincash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr'
const OTHER_ADDRESS = 'bitcoincash:qzl0d3gcqeypv4cy7gh8rgdszxa9vvm2acv7fqtd00'
const CID = 'bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m'
const PAYMENT_TXID = 'be4b63156c93f58ed311d403d9f756deda9abbc81d0fef8fbe5d769538b4261c'
const PAYMENT_TX = {
  txid: PAYMENT_TXID,
  vout: [
    { value: 2000, scriptPubKey: { addresses: [PAYOUT_ADDRESS] } }
  ]
}

describe('#ipfs-use-case', () => {
  let uut
  let sandbox

  before(async () => {

  })

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new IpfsUseCase({ adapters })
    uut.PSFFPP = PSFFPPMock.PSFFPPMock
    uut.requiredSatsBCH = PSFFPPMock.requiredSatsBCH
    uut.config.pinServiceUrl = 'https://pin.example.com'
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

  describe('#_getPinServiceQuote', () => {
    it('should return the payout address and rate from the pin-service', async () => {
      uut.config.pinServiceUrl = 'https://pin.example.com'
      sandbox.stub(uut.axios, 'get').resolves({
        data: { address: PAYOUT_ADDRESS, satsPerMb: 2000 }
      })

      const result = await uut._getPinServiceQuote()

      assert.equal(result.address, PAYOUT_ADDRESS)
      assert.equal(result.satsPerMb, 2000)
    })

    it('should fail closed if the pin-service URL is not configured', async () => {
      try {
        uut.config.pinServiceUrl = ''

        await uut._getPinServiceQuote()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'PIN_SERVICE_URL is not configured')
      }
    })

    it('should fail closed if the pin-service can not be reached', async () => {
      try {
        uut.config.pinServiceUrl = 'https://pin.example.com'
        sandbox.stub(uut.axios, 'get').rejects(new Error('test error'))

        await uut._getPinServiceQuote()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Failed to get a pin price')
        assert.include(err.message, 'test error')
      }
    })

    it('should fail closed if no payout address is returned', async () => {
      try {
        uut.config.pinServiceUrl = 'https://pin.example.com'
        sandbox.stub(uut.axios, 'get').resolves({ data: { satsPerMb: 2000 } })

        await uut._getPinServiceQuote()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'did not return a payout address')
      }
    })

    it('should fail closed if no satsPerMb rate is returned', async () => {
      try {
        uut.config.pinServiceUrl = 'https://pin.example.com'
        sandbox.stub(uut.axios, 'get').resolves({ data: { address: PAYOUT_ADDRESS } })

        await uut._getPinServiceQuote()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'did not return a usable satsPerMb rate')
      }
    })

    it('should fail closed on a non-numeric satsPerMb rate', async () => {
      try {
        uut.config.pinServiceUrl = 'https://pin.example.com'
        sandbox.stub(uut.axios, 'get').resolves({ data: { address: PAYOUT_ADDRESS, satsPerMb: '2000' } })

        await uut._getPinServiceQuote()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'did not return a usable satsPerMb rate')
      }
    })
  })

  describe('#getPaymentAddr', () => {
    it('should quote the payout address and required sats', async () => {
      sandbox.stub(uut, 'getBchCost').resolves({
        address: PAYOUT_ADDRESS,
        satsRequired: 2000,
        bchCost: 0.00002
      })

      const result = await uut.getPaymentAddr({ sizeInMb: 1 })

      assert.equal(result.address, PAYOUT_ADDRESS)
      assert.equal(result.satsRequired, 2000)
      assert.equal(result.bchCost, 0.00002)
    })

    it('should not generate a key pair or store a payment record', async () => {
      const keyPairSpy = sandbox.spy(uut.adapters.wallet, 'getKeyPair')
      sandbox.stub(uut, 'getBchCost').resolves({
        address: PAYOUT_ADDRESS,
        satsRequired: 2000,
        bchCost: 0.00002
      })

      await uut.getPaymentAddr({ sizeInMb: 1 })

      assert.isFalse(keyPairSpy.called, 'getKeyPair() must not be called')
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
    it('should quote the cost in sats for a 1 MB file', async () => {
      sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })

      const result = await uut.getBchCost({ sizeInMb: 1 })

      assert.equal(result.address, PAYOUT_ADDRESS)
      assert.equal(result.satsRequired, 2000)
      assert.equal(result.bchCost, 0.00002)
    })

    it('should apply the 100 KB floor to small files', async () => {
      sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })

      // 10 KB is below the floor: ceil(0.1 * 2000) = 200 sats.
      const result = await uut.getBchCost({ sizeInMb: 0.01 })

      assert.equal(result.satsRequired, 200)
    })

    it('should round the file size up to whole bytes', async () => {
      sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })

      // 0.1000001 MB → 100001 bytes → 201 sats, just above the floor.
      const result = await uut.getBchCost({ sizeInMb: 0.1000001 })

      assert.equal(result.satsRequired, 201)
    })

    it('should fail closed if the quote can not be retrieved', async () => {
      try {
        sandbox.stub(uut, '_getPinServiceQuote').rejects(new Error('uut error'))

        await uut.getBchCost({ sizeInMb: 1 })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'uut error')
      }
    })

    it('should fail closed if psffpp can not quote the fee schedule', async () => {
      try {
        sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })
        // Simulate a psffpp release that predates requiredSatsBCH().
        uut.requiredSatsBCH = undefined

        await uut.getBchCost({ sizeInMb: 1 })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'does not implement requiredSatsBCH()')
      }
    })

    it('should fail closed on a bad file size', async () => {
      try {
        await uut.getBchCost({ sizeInMb: '1' })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'sizeInMb must be a finite number')
      }
    })
  })

  describe('#_getPaymentTx', () => {
    it('should fetch the payment transaction', async () => {
      sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').resolves([PAYMENT_TX])

      const result = await uut._getPaymentTx({
        paymentTxid: PAYMENT_TXID,
        wallet: uut.adapters.wallet.bchWallet
      })

      assert.equal(result.txid, PAYMENT_TX.txid)
    })

    it('should throw if the payment TX can not be fetched', async () => {
      try {
        sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').rejects(new Error('test error'))

        await uut._getPaymentTx({
          paymentTxid: PAYMENT_TXID,
          wallet: uut.adapters.wallet.bchWallet
        })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, `Could not fetch payment TX ${PAYMENT_TXID}`)
      }
    })

    it('should throw if the payment TX is not found', async () => {
      try {
        sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').resolves([undefined])

        await uut._getPaymentTx({
          paymentTxid: PAYMENT_TXID,
          wallet: uut.adapters.wallet.bchWallet
        })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'was not found on the blockchain')
      }
    })
  })

  describe('#_satsPaidToAddress', () => {
    it('should sum the sats paid to an address in legacy format', () => {
      const legacyAddress = uut.adapters.wallet.bchWallet.bchjs.Address.toLegacyAddress(PAYOUT_ADDRESS)

      const result = uut._satsPaidToAddress({
        txData: {
          vout: [
            { value: 1000, scriptPubKey: { addresses: [legacyAddress] } },
            { value: 500, scriptPubKey: { address: PAYOUT_ADDRESS } },
            { value: 7000, scriptPubKey: { addresses: [OTHER_ADDRESS] } },
            { value: 0, scriptPubKey: { type: 'nulldata' } }
          ]
        },
        address: PAYOUT_ADDRESS
      })

      assert.equal(result, 1500)
    })

    it('should decode a script when the back end omits the address', () => {
      // scriptPubKey of PAYOUT_ADDRESS, in hex only (no decoded addresses).
      const scriptHex = '76a914efb0b43fb6c6afb927cdb90e98409acdec16e12f88ac'

      const result = uut._satsPaidToAddress({
        txData: { vout: [{ value: 2000, scriptPubKey: { hex: scriptHex } }] },
        address: PAYOUT_ADDRESS
      })

      assert.equal(result, 2000)
    })

    it('should return 0 if the address is not paid', () => {
      const result = uut._satsPaidToAddress({
        txData: { vout: [{ value: 1000, scriptPubKey: { addresses: [OTHER_ADDRESS] } }] },
        address: PAYOUT_ADDRESS
      })

      assert.equal(result, 0)
    })

    it('should throw on an unusable payout address', () => {
      try {
        uut._satsPaidToAddress({ txData: { vout: [] }, address: 'not-an-address' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Unsupported address format')
      }
    })
  })

  describe('#createPinClaim', () => {
    it('should build a pin claim for a verified payment', async () => {
      sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').resolves([PAYMENT_TX])
      sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })

      const result = await uut.createPinClaim({
        cid: CID,
        filename: 'test.txt',
        paymentTxid: PAYMENT_TXID
      })

      assert.isTrue(result.success)
      assert.equal(result.paymentTxid, PAYMENT_TXID)
      assert.equal(result.claimTxid, 'fake-claim-txid')
    })

    it('should not sweep funds, burn PSF, or write a payment record', async () => {
      sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').resolves([PAYMENT_TX])
      sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })

      const sendTxSpy = sandbox.spy(uut.adapters.wallet.bchWallet.ar, 'sendTx')

      await uut.createPinClaim({
        cid: CID,
        filename: 'test.txt',
        paymentTxid: PAYMENT_TXID
      })

      assert.isFalse(sendTxSpy.called, 'No transaction other than the claim may be broadcast')
    })

    it('should throw if the payment does not pay the payout address', async () => {
      try {
        sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').resolves([
          { vout: [{ value: 2000, scriptPubKey: { addresses: [OTHER_ADDRESS] } }] }
        ])
        sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })

        await uut.createPinClaim({
          cid: CID,
          filename: 'test.txt',
          paymentTxid: PAYMENT_TXID
        })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'does not pay the payout address')
      }
    })

    it('should throw if the payment TX has not been seen yet', async () => {
      try {
        sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').resolves([])

        await uut.createPinClaim({
          cid: CID,
          filename: 'test.txt',
          paymentTxid: PAYMENT_TXID
        })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'was not found on the blockchain')
      }
    })

    it('should throw if the psffpp library can not build a BCH claim', async () => {
      try {
        sandbox.stub(uut.adapters.wallet.bchWallet, 'getTxData').resolves([PAYMENT_TX])
        sandbox.stub(uut, '_getPinServiceQuote').resolves({ address: PAYOUT_ADDRESS, satsPerMb: 2000 })

        // Simulate an older psffpp release, without createPinClaimBCH().
        uut.PSFFPP = class {}

        await uut.createPinClaim({
          cid: CID,
          filename: 'test.txt',
          paymentTxid: PAYMENT_TXID
        })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'does not implement createPinClaimBCH()')
      }
    })

    it('should throw if paymentTxid is not included', async () => {
      try {
        await uut.createPinClaim({ cid: CID, filename: 'test.txt' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'paymentTxid required to create a pin claim.')
      }
    })

    it('should throw if cid is not included', async () => {
      try {
        await uut.createPinClaim({ filename: 'test.txt', paymentTxid: PAYMENT_TXID })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'cid required to create a pin claim.')
      }
    })

    it('should throw if filename is not included', async () => {
      try {
        await uut.createPinClaim({ cid: CID, paymentTxid: PAYMENT_TXID })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'filename required to create a pin claim.')
      }
    })
  })
})
