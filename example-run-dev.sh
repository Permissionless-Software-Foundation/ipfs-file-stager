#!/bin/bash

# Customize this script with the following environment variables:

# Debug level. 0 = minimal info. 2 = max info.
# This value set by docker-compose.yml
export DEBUG_LEVEL=0

# Configure REST API port
export PORT=5040

# Allow users to pay with BCH, instead of SLP tokens.
#export ENABLE_BCH_PAYMENTS=true

npm start
