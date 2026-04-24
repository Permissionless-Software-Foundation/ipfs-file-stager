export ENABLE_BCH_PAYMENTS=1
#export WALLET_INTERFACE=web2
#export APISERVER=

export PORT=5040
export API_PREFIX=/ipfs/generatePinClaim

export X402_ENABLED=true
export SERVER_BASE_ADDRESS=0xd32585CE60815654C50CAf350e18de8096061e63
export X402_PRICE_USDC=0.01


# Network configuration (CAIP-2 format required by CDP)
# Use 'eip155:8453' for Base mainnet
# Use 'eip155:84532' for Base Sepolia (testnet)
export x402_NETWORK=eip155:8453

# Primary Facilitator
# Options: 'cdp' (Coinbase) or 'dexter' (Dexter.cash - no API keys required)
export PRIMARY_FACILITATOR=dexter

export FACILITATOR_KEY_ID=a559e363-13f5-40a0-9e11-de3f6514289f
export FACILITATOR_SECRET_KEY=1zOMxx92exSMydM8Kqh+kiIw8XHXsor3bUi/fQAlmx4YewOEiCcUzEvGaBSgrpyGoEjlUw9VT14nDpu4tZTRDA==


node index.js