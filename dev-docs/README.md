# Developer Documentation

This directory needs to be fleshed out with more information. The markdown files in this directory are intended to provide additional documentation for software developers that use this boilerplate to run their own forks.

## Startup
This software requires an IPFS node in order to operate the JSON RPC and ipfs-coord features. There are two ways to incorporate an IPFS node:

- js-ipfs is integrated into this repository. If you simply run `npm start`, then this app will default to the js-ipfs IPFS node. However, js-ipfs is not as full featured as go-ipfs. It has memory leaks and lags considerably behind go-ipfs in terms of features.

- go-ipfs is the preferred way to run a node. It can be run externally by following the guidence on the [IPFS homepage](https://ipfs.io). Once the IPFS node is running, this app can take control of it. Use the [local-external-ipfs-node.sh](../shell-scripts/local-external-ipfs-node.sh) shell script to start this app and attach it to the go-ipfs node.

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
