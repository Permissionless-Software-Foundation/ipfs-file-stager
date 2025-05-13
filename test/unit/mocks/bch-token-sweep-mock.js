
class BchTokenSweepMock {
    constructor() {
      this.populateObjectFromNetwork = async () => {
        return true
      }
      this.sweepTo = async () => {
        return 'txid'
      }


    }
}

export default { BchTokenSweepMock }
