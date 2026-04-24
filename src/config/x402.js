import config from '../../config/index.js'
import { generateJwt } from '@coinbase/cdp-sdk/auth'
import { declareDiscoveryExtension } from '@x402/extensions/bazaar'

const DEFAULT_DESCRIPTION = 'Access to protected ipfs-file-stager resources'
const DEFAULT_TIMEOUT_SECONDS = 120

const FACILITATORS = {
  cdp: {
    name: 'Coinbase CDP',
    url: 'https://api.cdp.coinbase.com/platform/v2/x402',
    requiresAuth: true,
    authType: 'jwt'
  },
  dexter: {
    name: 'Dexter',
    url: 'https://x402.dexter.cash',
    requiresAuth: false,
    authType: 'none'
  },
  payai: {
    name: 'PayAI',
    url: 'https://facilitator.payai.network',
    requiresAuth: false,
    authType: 'none'
  }
}

function assertEvmPayTo (payTo) {
  if (typeof payTo !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error(
      'SERVER_BASE_ADDRESS must be a 0x-prefixed 40-hex EVM address (Base USDC settlement).'
    )
  }
}

export function buildX402Routes (apiPrefix) {
  const prefix = apiPrefix || config.apiPrefix || '/ipfs'
  const normalizedPrefix = prefix.endsWith('/')
    ? prefix.slice(0, -1)
    : prefix
  const prefixWithSlash = normalizedPrefix.startsWith('/')
    ? normalizedPrefix
    : `/${normalizedPrefix}`

  const routeKey = `* ${prefixWithSlash}*`
  console.log('routeKey: ', routeKey)
  const network = config.x402.network
  if (!network) throw new Error('x402 network is required (set x402_NETWORK / X402_NETWORK).')

  const payTo = config.x402.serverAddress
  if (!payTo) throw new Error('SERVER_BASE_ADDRESS is required for x402 v2 payTo.')
  assertEvmPayTo(payTo)

  const entry = {
    accepts: [
      {
        scheme: 'exact',
        payTo,
        price: config.x402.priceUSDC,
        network,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS
      }
    ],
    description: `${DEFAULT_DESCRIPTION} (${config.x402.priceUSDC} USDC)`,
    mimeType: 'application/json'
  }

  if (config.x402.bazaarEnabled) {
    entry.extensions = declareDiscoveryExtension({
      output: {
        example: {
          service: 'ipfs-file-stager',
          apiPrefix: prefixWithSlash,
          description: 'IPFS file staging for PSF File Pinning (x402 USDC on Base)'
        }
      }
    })
  }

  return {
    [routeKey]: entry
  }
}

export const DEFAULT_MULTI_FACILITATORS = ['cdp', 'dexter', 'payai']

export function getFacilitatorHttpUrl (key) {
  const k = String(key || 'cdp').trim().toLowerCase()
  if (k === 'dexter') return 'https://x402.dexter.cash'
  if (k === 'payai') {
    return (process.env.PAYAI_FACILITATOR_URL || 'https://facilitator.payai.network')
      .trim()
      .replace(/\/$/, '')
  }
  return 'https://api.cdp.coinbase.com/platform/v2/x402'
}

export function resolvePrimaryFacilitatorKey () {
  const primaryRaw = (
    process.env.PRIMARY_FACILITATOR ||
    config.x402?.primaryFacilitator ||
    'cdp'
  ).trim().toLowerCase()
  return FACILITATORS[primaryRaw] ? primaryRaw : 'cdp'
}

export function getActiveFacilitatorKeys () {
  const primary = resolvePrimaryFacilitatorKey()
  const raw = (process.env.ACTIVE_FACILITATORS || '').trim()
  if (!raw) {
    return [primary]
  }
  const fromEnv = raw.split(',').map(s => s.trim().toLowerCase()).filter(k => FACILITATORS[k])
  if (fromEnv.length === 0) {
    return [primary]
  }
  const rest = fromEnv.filter(k => k !== primary)
  return [primary, ...rest]
}

export function getFacilitatorConnectionOptions () {
  const keys = getActiveFacilitatorKeys()
  return keys.map(key => {
    const cfg = getFacilitatorConfig(key)
    const url =
      keys.length === 1 ? config.x402.facilitatorUrl : getFacilitatorHttpUrl(key)
    return {
      key,
      name: cfg.name,
      url,
      requiresAuth: Boolean(cfg.requiresAuth)
    }
  })
}

export function getX402Settings () {
  return {
    enabled: Boolean(config.x402?.enabled),
    bazaarEnabled: Boolean(config.x402?.bazaarEnabled),
    activeFacilitatorKeys: getActiveFacilitatorKeys(),
    facilitatorUrl: config.x402?.facilitatorUrl,
    facilitatorKeyId: config.x402?.facilitatorKeyId,
    facilitatorSecretKey: config.x402?.facilitatorSecretKey,
    serverAddress: config.x402?.serverAddress,
    priceUSDC: config.x402?.priceUSDC,
    usdcAssetAddress: config.x402?.usdcAssetAddress,
    network: config.x402?.network,
    facilitators: FACILITATORS,
    primaryFacilitator: config.x402?.primaryFacilitator || 'cdp'
  }
}

export function getX402WellKnownManifest (apiPrefix) {
  const prefix = apiPrefix || config.apiPrefix || '/ipfs'
  const normalizedPrefix = prefix.endsWith('/')
    ? prefix.slice(0, -1)
    : prefix
  const prefixWithSlash = normalizedPrefix.startsWith('/')
    ? normalizedPrefix
    : `/${normalizedPrefix}`

  const network = config.x402.network
  if (!network) throw new Error('x402 network is required (set x402_NETWORK / X402_NETWORK).')

  const payTo = config.x402.serverAddress
  if (!payTo) throw new Error('SERVER_BASE_ADDRESS is required for x402 v2 payTo.')
  assertEvmPayTo(payTo)

  return {
    x402Version: 2,
    network,
    facilitator: {
      url: config.x402.facilitatorUrl
    },
    resources: [
      {
        resource: `${prefixWithSlash}/*`,
        type: 'http',
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network,
            price: config.x402.priceUSDC,
            payTo,
            maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
            description: `${DEFAULT_DESCRIPTION} (${config.x402.priceUSDC} USDC)`,
            mimeType: 'application/json',
            extra: { }
          }
        ]
      }
    ]
  }
}

export function getX402AgentAuthPricing () {
  const x402 = config.x402
  if (!x402?.enabled || !x402.serverAddress || !x402.network) return null
  try {
    assertEvmPayTo(x402.serverAddress)
  } catch {
    return null
  }
  return {
    scheme: 'exact',
    x402Version: 2,
    network: x402.network,
    payTo: x402.serverAddress,
    priceUSDC: x402.priceUSDC,
    facilitatorUrl: x402.facilitatorUrl
  }
}

export async function createAuthHeader () {
  const id = config.x402?.facilitatorKeyId
  const secret = config.x402?.facilitatorSecretKey
  if (!id || !secret) {
    return {
      verify: {},
      settle: {},
      supported: {}
    }
  }

  const verifyToken = await generateJwt({
    apiKeyId: id,
    apiKeySecret: secret,
    requestMethod: 'POST',
    requestHost: 'api.cdp.coinbase.com',
    requestPath: '/platform/v2/x402/verify'
  })
  const settleToken = await generateJwt({
    apiKeyId: id,
    apiKeySecret: secret,
    requestMethod: 'POST',
    requestHost: 'api.cdp.coinbase.com',
    requestPath: '/platform/v2/x402/settle'
  })
  const supportedToken = await generateJwt({
    apiKeyId: id,
    apiKeySecret: secret,
    requestMethod: 'GET',
    requestHost: 'api.cdp.coinbase.com',
    requestPath: '/platform/v2/x402/supported'
  })

  return {
    verify: {
      Authorization: `Bearer ${verifyToken}`
    },
    settle: {
      Authorization: `Bearer ${settleToken}`
    },
    supported: {
      Authorization: `Bearer ${supportedToken}`
    }
  }
}

export function getFacilitatorConfig (name = 'cdp') {
  const key = String(name || 'cdp').trim().toLowerCase()
  return FACILITATORS[key] || FACILITATORS.cdp
}

export function facilitatorRequiresAuth (name = 'cdp') {
  const key = String(name || 'cdp').trim().toLowerCase()
  const cfg = FACILITATORS[key]
  return cfg ? cfg.requiresAuth : false
}
