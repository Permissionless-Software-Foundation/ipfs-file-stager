#!/bin/bash

# Customize this script with the following environment variables:

# Debug level. 0 = minimal info. 2 = max info.
# This value set by docker-compose.yml
export DEBUG_LEVEL=0

# Configure REST API port
export PORT=5040

# Allow users to pay for pins with BCH.
#export ENABLE_BCH_PAYMENTS=true

# Base URL of the pin-service. It serves the BCH payout address and the
# sats/MB rate (GET /ipfs/payment-address), and validates the payment before
# pinning the file. Required when ENABLE_BCH_PAYMENTS is set.
#export PIN_SERVICE_URL=http://localhost:5031

npm start
