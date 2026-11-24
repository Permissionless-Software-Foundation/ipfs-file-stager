# Developer Documentation

This directory needs to be fleshed out with more information. The markdown files in this directory are intended to provide additional documentation for software developers that use this boilerplate to run their own forks.

## Startup
This software requires an IPFS node in order to operate the JSON RPC and ipfs-coord features. The IPFS node is embedded in this application: there is no separate IPFS binary to install or run.

The node is created at startup by the [`helia-coord`](https://www.npmjs.com/package/helia-coord) library (see `src/adapters/ipfs/ipfs.js`), and its datastore lives in the `.ipfsdata` directory. Simply run `npm start` and the embedded Helia node comes up with the REST API. Its ports are configured with the `IPFS_TCP_PORT`, `IPFS_WS_PORT` and `IPFS_WEB_RTC_PORT` environment variables, so no external node config file needs to be edited and no separate startup script is needed.

## BCH payments (PS010 v2.0.0)

Pins are paid for in BCH, not PSF tokens. The flow crosses three services:

1. This app quotes the price. `POST /ipfs/getBchCost` and
   `POST /ipfs/getPaymentAddr` call `GET {PIN_SERVICE_URL}/ipfs/payment-address`,
   which returns `{ address, satsPerMb }`, then compute
   `satsRequired = requiredSatsBCH({ fileSizeBytes, satsPerMb })`. That helper
   (from the `psffpp` library) already includes the locked 100 KB minimum
   charge, so nothing here re-derives a floor.
2. The user's wallet sends `satsRequired` to `address`. The payment goes
   straight to the pin-service payout address. This app never sees the funds,
   never holds a per-payment WIF, and keeps no payment record in Mongo.
3. The client calls `POST /ipfs/createPinClaim` with
   `{ cid, filename, paymentTxid }`. This app fetches the payment transaction,
   verifies that it pays the payout address, and publishes the Pin Claim with
   the payment txid in field 2 of the OP_RETURN (via `psffpp.createPinClaimBCH()`).
   The pin-service validates the amount of that payment before pinning.

Configuration:

- `ENABLE_BCH_PAYMENTS=true` enables the payment endpoints.
- `PIN_SERVICE_URL` is the base URL of the pin-service (e.g.
  `http://localhost:5031`). It is required: every quote and every payment
  verification reads the payout address and rate from it.

Both quote paths fail closed: no pin-service, no payout address, or no
`satsPerMb` rate means an error, never a guessed address or a hardcoded price.

The only wallet this app needs is one funded with a little BCH to pay the fee of
the Pin Claim transactions it broadcasts. It does not need PSF tokens.

Dependency note: this path requires a `psffpp` release that provides
`createPinClaimBCH()` and `requiredSatsBCH`. Until such a release is published,
the quote and claim endpoints fail closed with an explicit
'update the psffpp dependency' error.
