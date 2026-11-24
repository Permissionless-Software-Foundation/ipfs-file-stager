/*
  Unit tests for the config directory
*/

import { assert } from 'chai'

let currentEnv

describe('#config', () => {
  before(() => {
    // Backup the current environment setting.
    currentEnv = process.env.SVC_ENV
    // Clear SVC_ENV for the first test to ensure default behavior
    delete process.env.SVC_ENV
  })

  after(() => {
    // Restore the environment setting before starting these tests.
    if (currentEnv) {
      process.env.SVC_ENV = currentEnv
    } else {
      delete process.env.SVC_ENV
    }
  })

  it('Should return development environment config by default', async () => {
    // Ensure SVC_ENV is not set for this test
    delete process.env.SVC_ENV
    const importedConfig = await import('../../../config/index.js?foo=bar0')
    const config = importedConfig.default
    // console.log('config: ', config)

    assert.equal(config.env, 'dev')
  })

  it('Should return test environment config', async () => {
    // Hack to dynamically import a library multiple times:
    // https://github.com/denoland/deno/issues/6946

    process.env.SVC_ENV = 'test'

    const importedConfig2 = await import('../../../config/index.js?foo=bar1')
    const config = importedConfig2.default
    // console.log('config: ', config)

    assert.equal(config.env, 'test')
  })

  it('Should return prod environment config', async () => {
    process.env.SVC_ENV = 'prod'

    process.env.WALLET_INTERFACE = 'web2'
    process.env.APISERVER = 'https://api.fullstack.cash/v5/'

    await import('../../../config/env/common.js?foo=bar2')
    const importedConfig3 = await import('../../../config/index.js?foo=bar2')
    const config = importedConfig3.default
    // console.log('config: ', config)

    assert.equal(config.env, 'prod')
  })

  it('Should strip a trailing slash from PIN_SERVICE_URL', async () => {
    process.env.PIN_SERVICE_URL = 'http://127.0.0.1:5031/'

    // Import common.js directly with a unique cache-busting query so the module
    // is re-evaluated with the env var just set (a trailing slash on the
    // pin-service URL produces '//ipfs/payment-address' which 404s).
    const { default: common } = await import('../../../config/env/common.js?stripTest=1')

    assert.equal(common.pinServiceUrl, 'http://127.0.0.1:5031')

    delete process.env.PIN_SERVICE_URL
  })

  it('Should leave a PIN_SERVICE_URL without trailing slash unchanged', async () => {
    process.env.PIN_SERVICE_URL = 'http://127.0.0.1:5031'

    const { default: common } = await import('../../../config/env/common.js?stripTest=2')

    assert.equal(common.pinServiceUrl, 'http://127.0.0.1:5031')

    delete process.env.PIN_SERVICE_URL
  })
})
