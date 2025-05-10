/*
  Mocks for the Adapter library.
*/

import { MockBchWallet } from "./wallet.js"

class IpfsAdapter {
  constructor () {
    this.ipfs = {
      files: {
        stat: () => {}
      }
    }
  }
}

class IpfsCoordAdapter {
  constructor () {
    this.ipfsCoord = {
      adapters: {
        ipfs: {
          connectToPeer: async () => {}
        }
      },
      useCases: {
        peer: {
          sendPrivateMessage: () => {}
        }
      },
      thisNode: {}
    }
  }
}

const ipfs = {
  ipfsAdapter: new IpfsAdapter(),
  ipfsCoordAdapter: new IpfsCoordAdapter(),
  getStatus: async () => {},
  getPeers: async () => {},
  getRelays: async () => {}
}
ipfs.ipfs = ipfs.ipfsAdapter.ipfs

const localdb = {
  Users: class Users {
    static findById () {}
    static find () {}
    static findOne () {
      return {
        validatePassword: localdb.validatePassword
      }
    }

    async save () {
      return {}
    }

    generateToken () {
      return '123'
    }

    toJSON () {
      return {}
    }

    async remove () {
      return true
    }

    async validatePassword () {
      return true
    }
  },
  BchPayment: class BchPayment {
    static findById () {}
    static find () {}
    static findOne () {
      return {
        validatePassword: localdb.validatePassword
      }
    }

    async save () {
      return {}
    }

    generateToken () {
      return '123'
    }

    toJSON () {
      return {}
    }

    async remove () {
      return true
    }

    async validatePassword () {
      return true
    }
  },

  validatePassword: () => {
    return true
  }
}

class WalletAdapterMock {
  constructor() {
   this.bchWallet = new MockBchWallet()
  }
  async getBalance() {
    return 100
  }
  async getKeyPair() {
    return {
      cashAddress: 'bitcoincash:qqraj35x6l2qyqhjm5l7qlt7z2245ez8l5z3dwkeq5',
      wif: 'L3QjWK2Z8YQK983Gg2Y8YQK983Gg2Y8YQK983Gg2Y8YQK983Gg2Y',
      hdIndex: 0
    }
  }
}

const wallet = new WalletAdapterMock()

export default { ipfs, localdb, wallet };
