class PSFFPPMock {
  constructor () {
    this.createPinClaim = async () => ({
      pobTxid: 'pob-txid',
      claimTxid: 'claim-txid'
    })
  }
}

export default { PSFFPPMock }