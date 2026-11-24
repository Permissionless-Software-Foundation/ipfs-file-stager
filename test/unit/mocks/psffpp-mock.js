
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
// tested in the psffpp repo; here it only stands in for the dependency.
function requiredSatsBCH (inObj = {}) {
  const { fileSizeBytes, satsPerMb } = inObj

  return Math.max(
    Math.ceil((fileSizeBytes * satsPerMb) / 1000000),
    Math.ceil(satsPerMb / 10)
  )
}

export default { PSFFPPMock, requiredSatsBCH }
