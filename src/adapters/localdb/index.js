/*
  This library encapsulates code concerned with MongoDB and Mongoose models.
*/

// Load Mongoose models.
import Users from './models/users.js'
import BchPayment from './models/bch-payment.js'
import Usage from './models/usage.js'

class LocalDB {
  constructor () {
    // Encapsulate dependencies
    this.Users = Users
    this.BchPayment = BchPayment
    this.Usage = Usage
  }
}

export default LocalDB
