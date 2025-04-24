/*
  A BCH payment model is created when a user requests payment
  for a Pin Claim in BCH.
*/

import mongoose from 'mongoose'

const BchPayment = new mongoose.Schema({
  address: { type: String, required: true },
  wif: { type: String, required: true },
  bchCost: { type: Number, required: true },
  timeCreated: { type: String }, // ISO date string.
  hdIndex: { type: String, required: true },
  sizeInMb: { type: Number, required: true },
  pobTxId: { type: String, default: '' },
  claimTxId: { type: String, default: '' }
})

export default mongoose.model('bchPayment', BchPayment)
