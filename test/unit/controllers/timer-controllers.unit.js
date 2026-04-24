/*
  Unit tests for the timer-controller.js Controller library
*/

// Public npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import TimerControllers from '../../../src/controllers/timer-controllers.js'
import adapters from '../mocks/adapters/index.js'
import UseCasesMock from '../mocks/use-cases/index.js'

describe('#Timer-Controllers', () => {
  let uut
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    const useCases = new UseCasesMock()
    uut = new TimerControllers({ adapters, useCases })
  })

  afterEach(() => {
    sandbox.restore()

    uut.stopTimers()
  })

  describe('#constructor', () => {
    it('should throw an error if adapters are not passed in', () => {
      try {
        uut = new TimerControllers()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of Adapters library required when instantiating Timer Controller libraries.'
        )
      }
    })

    it('should throw an error if useCases are not passed in', () => {
      try {
        uut = new TimerControllers({ adapters })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of Use Cases library required when instantiating Timer Controller libraries.'
        )
      }
    })
  })

  describe('#startTimers', () => {
    it('should start the timers', () => {
      const result = uut.startTimers()

      uut.stopTimers()

      assert.equal(result, true)
    })
  })

  // describe('#exampleTimerFunc', () => {
  //   it('should kick off the Use Case', async () => {
  //     const result = await uut.exampleTimerFunc()

  //     assert.equal(result, true)
  //   })

  //   it('should return false on error', async () => {
  //     const result = await uut.exampleTimerFunc(true)

  //     assert.equal(result, false)
  //   })
  // })

  describe('#cleanUsage', () => {
    it('should kick off the Use Case', async () => {
      const result = await uut.cleanUsage()

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
      sandbox.stub(uut.useCases.usage, 'cleanUsage').throws(new Error('test error'))
      const result = await uut.cleanUsage()

      assert.equal(result, false)
    })
  })

  describe('#clearStagedFiles', () => {
    it('should kick off the Use Case', async () => {
      const result = await uut.clearStagedFiles()

      assert.equal(result, true)
    })

    it('should return false when clearStagedFiles throws', () => {
      sandbox.stub(uut.useCases.ipfs, 'clearStagedFiles').throws(new Error('stager fail'))
      const result = uut.clearStagedFiles()
      assert.equal(result, false)
    })
  })

  describe('#backupUsage', () => {
    it('should kick off the Use Case', async () => {
      const result = await uut.backupUsage()

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
      sandbox.stub(uut.useCases.usage, 'clearUsage').throws(new Error('test error'))
      // sandbox.stub(uut.useCases.usage, 'saveUsage').throws(new Error('test error'))

      const result = await uut.backupUsage()

      assert.equal(result, false)
    })

    it('should return false when saveUsage throws after clear', async () => {
      sandbox.stub(uut.useCases.usage, 'clearUsage').resolves()
      sandbox.stub(uut.useCases.usage, 'saveUsage').rejects(new Error('save fail'))
      const result = await uut.backupUsage()
      assert.equal(result, false)
    })
  })

  describe('#updateWritePrice', () => {
    it('should update cache and return when getPsfWritePrice succeeds', async () => {
      const wp = sandbox.stub(uut.adapters.wallet.bchWallet, 'getPsfWritePrice').resolves(0.5)
      const res = await uut.updateWritePrice()
      assert.isTrue(wp.called)
      assert.isUndefined(res)
    })

    it('should return false on error', async () => {
      sandbox.stub(uut.adapters.wallet.bchWallet, 'getPsfWritePrice').rejects(new Error('price fail'))
      const res = await uut.updateWritePrice()
      assert.equal(res, false)
    })
  })
})
