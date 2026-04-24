/*
  Map Koa context to what @x402/express expects, and shim Node ServerResponse with
  minimal Express-style helpers (Koa+connect passes raw res without res.json/res.status).
*/

function ensureExpressResponse (res) {
  if (res.__x402Patched) return

  if (typeof res.status !== 'function') {
    res.status = function (code) {
      this.statusCode = code
      return this
    }
  }
  if (typeof res.json !== 'function') {
    res.json = function (body) {
      if (body === undefined) body = null
      if (!this.getHeader('Content-Type')) {
        this.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      this.end(JSON.stringify(body))
    }
  }
  if (typeof res.send !== 'function') {
    res.send = function (body) {
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        this.end(body)
        return
      }
      this.json(body)
    }
  }

  res.__x402Patched = true
}

export function x402ExpressReqBridge () {
  return async (ctx, next) => {
    ensureExpressResponse(ctx.res)

    const req = ctx.req
    const request = ctx.request

    req.path = ctx.path
    req.query = request.query
    req.body = request.body
    if (!req.originalUrl) req.originalUrl = request.originalUrl || ctx.url
    if (!req.protocol) req.protocol = request.protocol
    if (!req.host) req.host = request.host
    if (!req.locals) req.locals = {}

    if (typeof req.header !== 'function') {
      req.header = (name) => ctx.get(name)
    }
    if (typeof req.get !== 'function') {
      req.get = (name) => ctx.get(name)
    }

    return next()
  }
}
