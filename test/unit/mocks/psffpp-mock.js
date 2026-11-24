
class PSFFPPMock {
  constructor() {
    this.createPinClaim = async () => {
      return 'txid'
    }
    this.createPinClaimBCH = async (inObj = {}) => {
      return {
        paymentTxid: inObj.paymentTxid,
        claimTxid: 'fake-claim-txid'
      }
    }
  }
}

// Stand-in for the fee-schedule helper exported by psffpp. The real formula is
// tested in the psffpp repo; here it only stands in for the dependency. Kept in
// lockstep: current formula is max(metered, 100KB floor, dust limit 546).
function requiredSatsBCH (inObj = {}) {
  const { fileSizeBytes, satsPerMb } = inObj
  const DUST_SATS = 546

  return Math.max(
    Math.ceil((fileSizeBytes * satsPerMb) / 1000000),
    Math.ceil(satsPerMb / 10),
    DUST_SATS
  )
}

export default { PSFFPPMock, requiredSatsBCH }
