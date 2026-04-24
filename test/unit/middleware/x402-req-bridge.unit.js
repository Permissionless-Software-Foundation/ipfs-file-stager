/* eslint-env mocha */
import { assert } from 'chai'
import { x402ExpressReqBridge } from '../../../src/middleware/x402-req-bridge.js'

describe('#x402ExpressReqBridge', () => {
  it('patches res with status/json/send and maps req for Express', async () => {
    const setHeaderCalls = []
    const endCalls = []
    const res = {
      getHeader (name) {
        if (String(name).toLowerCase() === 'content-type') return undefined
        return undefined
      },
      setHeader (k, v) {
        setHeaderCalls.push([k, v])
      },
      end (data) {
        endCalls.push(data)
      }
    }
    const ctx = {
      path: '/ipfs/x',
      url: '/ipfs/x',
      get: (n) => (n === 'X-Test' ? 'v' : undefined),
      request: {
        query: { q: '1' },
        body: { a: 1 },
        originalUrl: '/ipfs/x',
        protocol: 'http',
        host: 'localhost:5040'
      },
      req: { headers: {} }
    }
    ctx.res = res

    const mw = x402ExpressReqBridge()
    let nexted = false
    await mw(ctx, async () => {
      nexted = true
    })

    assert.isTrue(nexted)
    assert.equal(ctx.req.path, '/ipfs/x')
    assert.deepEqual(ctx.req.query, { q: '1' })
    assert.deepEqual(ctx.req.body, { a: 1 })
    assert.equal(ctx.req.header('X-Test'), 'v')
    assert.equal(ctx.req.get('X-Test'), 'v')
    assert.deepEqual(ctx.req.locals, {})

    res.status(201)
    assert.equal(res.statusCode, 201)
    res.json({ ok: true })
    const ct = setHeaderCalls.find(c => c[0] === 'Content-Type')
    assert.isDefined(ct)
    assert.equal(ct[1], 'application/json; charset=utf-8')
    assert.equal(endCalls[0], '{"ok":true}')
  })

  it('res.send object uses json() path', async () => {
    const out = []
    const res = {
      getHeader: () => undefined,
      setHeader: () => {},
      end: (s) => out.push(s)
    }
    const ctx = {
      path: '/',
      get: () => undefined,
      request: { query: {}, body: null, originalUrl: '/', protocol: 'http', host: 'h' },
      req: { headers: {} }
    }
    ctx.res = res
    await x402ExpressReqBridge()(ctx, () => Promise.resolve())
    res.send({ p: 1 })
    const raw = out[0]
    assert.include(raw, '"p":1')
  })

  it('res.send string uses end', async () => {
    const out = []
    const res = {
      getHeader: () => undefined,
      setHeader: () => {},
      end: (s) => out.push(s)
    }
    const ctx = {
      path: '/',
      get: () => undefined,
      request: { query: {}, body: null, originalUrl: '/', protocol: 'http', host: 'h' },
      req: { headers: {} }
    }
    ctx.res = res
    await x402ExpressReqBridge()(ctx, () => Promise.resolve())
    res.send('plain')
    assert.equal(out[0], 'plain')
  })

  it('does not double-patch res (second middleware pass)', async () => {
    const res = { getHeader: () => undefined, setHeader: () => {}, end: () => {} }
    const ctx = {
      path: '/',
      get: () => undefined,
      request: { query: {}, body: null, originalUrl: '/', protocol: 'http', host: 'h' },
      req: { headers: {} }
    }
    ctx.res = res
    const mw = x402ExpressReqBridge()
    await mw(ctx, () => Promise.resolve())
    const status1 = res.status
    const json1 = res.json
    await mw(ctx, () => Promise.resolve())
    assert.strictEqual(res.status, status1)
    assert.strictEqual(res.json, json1)
  })
})
