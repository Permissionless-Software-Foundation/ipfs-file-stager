/**
 * x402 v2 + BCH Pin Claim flow (ipfs-file-stager).
 *
 * After each HTTP call, x402 (USDC on Base) may be charged if X402_ENABLED=true on the server.
 * Pin Claim creation is separate: the app uses BCH sent to a one-off address (ENABLE_BCH_PAYMENTS).
 *
 * Run from repo root:
 *   `PRIVATE_KEY=0x... node examples/03-x402-generatePinClaim.js`
 *
 * Server requirements:
 *   - ENABLE_BCH_PAYMENTS — BCH getPaymentAddr + createPinClaim
 *   - X402_ENABLED, SERVER_BASE_ADDRESS, etc. — paid access to /ipfs/* (if you use x402 on the instance)
 *
 * Optional env:
 *   - BASE_URL (default http://localhost:5040)
 *   - BCH_ADDRESS, STAGER_CID, FILENAME — skip getPaymentAddr + upload; go straight to createPinClaim
 *     (use after you funded the BCH address and already have a CID)
 *   - SIZE_MB (default 1) for getPaymentAddr
 *   - x402_NETWORK / X402_NETWORK, BASE_RPC_URL, PRIVATE_KEY / EVM_PRIVATE_KEY
 */
import axios, { AxiosHeaders } from 'axios'
import { Blob } from 'buffer'

import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { x402Client, wrapAxiosWithPayment } from '@x402/axios'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { toClientEvmSigner } from '@x402/evm'

/** In-memory payload for the multipart upload (no file on disk). */
function buildTestUploadFile () {
  const stamp = new Date().toISOString()
  const body = 'ipfs-file-stager x402 pin-claim test upload\n' +
    `created: ${stamp}\n` +
    'This text is generated in code for examples/03-x402-generatePinClaim.js\n'
  const filename = (process.env.FILENAME || 'test-x402-pin-claim.txt').trim()
  return { body, filename }
}

const baseURL = process.env.BASE_URL || 'http://localhost:5942'
const endpointPath = process.env.X402_TEST_PATH || '/ipfs/generatePinClaim'
const pKey = process.env.PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || ''
const x402Network = process.env.x402_NETWORK || process.env.X402_NETWORK || 'eip155:8453'
const sizeInMb = Math.max(1, Number(process.env.SIZE_MB || 1) || 1)

if (!pKey) {
  throw new Error('Set PRIVATE_KEY or EVM_PRIVATE_KEY (EVM key for x402 USDC on Base).')
}

const account = privateKeyToAccount(pKey)
const chain = x402Network === 'eip155:84532' ? baseSepolia : base
const defaultRpc =
  x402Network === 'eip155:84532'
    ? 'https://sepolia.base.org'
    : 'https://mainnet.base.org'
const publicClient = createPublicClient({
  chain,
  transport: http(process.env.BASE_RPC_URL || defaultRpc)
})
const signer = toClientEvmSigner(account, publicClient)

// eslint-disable-next-line new-cap
const x402 = new x402Client()
registerExactEvmScheme(x402, {
  signer,
  networks: [x402Network]
})

const api = wrapAxiosWithPayment(
  axios.create({
    baseURL,
    headers: new AxiosHeaders({
      Accept: 'application/json'
    })
  }),
  x402
)

async function uploadFile (apiClient) {
  const { body, filename: name } = buildTestUploadFile()
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(body, 'utf8')], { type: 'text/plain' }), name)

  console.log('\n[2] POST /ipfs/upload (multipart) — in-memory test file:', name, `(${body.length} bytes)`)
  const { data } = await apiClient.post('/ipfs/upload', form)
  const cid = data?.cid
  if (!cid) {
    throw new Error('Upload response missing cid: ' + JSON.stringify(data))
  }
  console.log('CID:', cid)
  return { cid, usedName: name }
}

const request = async () => {
  const up = await uploadFile(api)
  const cid = up.cid
  const fileLabel = up.usedName
  console.log('\n\nStep 1: unauthenticated GET, expect 402 when x402 is enabled.')
  const body = { fileSizeInMegabytes: sizeInMb, cid, filename: fileLabel }

  try {
    const response = await axios.post(baseURL + endpointPath, body)
    console.log(response.data)
    console.log('Step 1: got 2xx. If x402 is off, that is expected.')
  } catch (err) {
    console.log(`Status code: ${err?.response?.status}`)
    if (err?.response?.data) {
      console.log('Body:', JSON.stringify(err.response.data, null, 2))
    }
  }

  console.log('\n\nStep 2: paid GET via wrapAxiosWithPayment.')

  try {
    const paidRes = await api.post(endpointPath, body)
    console.log('Data after payment:', paidRes.data)
  } catch (err) {
    console.log('Step 2 failed:', err?.response?.status, err?.response?.statusText)
    if (err?.response?.data) {
      console.log(JSON.stringify(err.response.data, null, 2))
    }
    process.exit(1)
  }
}

request()
