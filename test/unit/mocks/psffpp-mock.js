class PSFFPPMock {
    constructor() {
        this.createPinClaim = async () => {
            return 'txid'
        }
    }
}

export default { PSFFPPMock }