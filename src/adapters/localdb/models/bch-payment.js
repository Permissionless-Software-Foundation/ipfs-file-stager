/*
  A BCH payment model is created when a user requests payment
  for a Pin Claim in BCH.
*/

import mongoose from 'mongoose'

const BchPayment = new mongoose.Schema({
  address: { type: String, required: true },
  bchCost: { type: String, required: true },
  timeCreated: { type: String }, // ISO date string.
  hdIndex: { type: String, required: true }
})

export default mongoose.model('bchPayment', BchPayment)
