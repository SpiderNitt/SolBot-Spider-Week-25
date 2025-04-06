# Welcome to the Building SolBot Workshop Codebase!

This repository contains the official implementation for the *"Building SolBot"* workshop — part of the **Spider Week 2025** series of workshops.

In this hands-on session, developers will learn how to build an automated trading system on the Solana blockchain, combining decentralized finance (DeFi) strategies with real-time market analysis.

The SolBot is an automated trading bot designed for lightning-fast token swaps on Solana using the Jupiter Aggregator. It detects new token listings within seconds of deployment and executes strategic buy/sell orders to optimize profits.

This codebase serves as both a reference implementation for the workshop and a production-ready trading tool.

## Features

- Automated detection of new token pairs
- Instant buy and immediate sell strategy
- Uses Jupiter Aggregator for optimal swap routes
- Error handling with transaction retries
- Trade history logging and persistence
- Wallet balance monitoring
- Configurable trade parameters

## Prerequisites

- Node.js (v14 or higher)
- NPM or Yarn
- A Solana wallet with SOL (minimum recommended: 0.05 SOL)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/SpiderNitt/SolBot-Spider-Week-25
cd solana-trading-bot
```
2. Install dependencies:
``` bash
npm install
```
3. Create a `.env` file in the root directory:
```bash
touch .env
```
4. Add your Solana wallet private key to the .env file:
```env
PRIVATE_KEY=your_private_key_here
```
## Configuration
Customize the bot's behavior by modifying the config object in the code:
```javascript
const config = {
  rpcEndpoint: 'https://api.mainnet-beta.solana.com', // Solana RPC endpoint
  jupiterApiUrl: 'https://quote-api.jup.ag/v6', // Jupiter API endpoint
  pairApiUrl: 'https://your-pair-detection-api.com', // Replace with your API endpoint
  pollingInterval: 10000, // Check for new pairs every 10 seconds
  slippageBps: 100, // 1% slippage tolerance (in basis points)
  maxTransactionRetries: 3, // Retry attempts for failed transactions
  defaultTradeAmountSOL: 0.01, // Default SOL amount per trade
  minWalletBalance: 0.02, // Minimum wallet balance to continue trading
  logFilePath: './trading_log.json', // Path to save trading history
  WSOL_ADDRESS: 'So11111111111111111111111111111111111111112', // Wrapped SOL address
  sellDelayMs: 2000, // Delay between buy and sell transactions
  debugMode: false, // Set to true for verbose logging
};
```
## API Requirements
The bot expects an API endpoint that returns new token pairs with a field info containing the token address. Configure pairApiUrl in the config object to point to your API.

Note: Replace `https://your-pair-detection-api.com` with your actual API endpoint.

## Usage
Start the bot:
```bash
npm start
```
The bot will:
- Load existing trade history
- Initialize the token list from Jupiter
- Check wallet balance
- Attempt to sell tokens from previous sessions
- Start monitoring for new token pairs

## Customization
- Trading Amount: Modify defaultTradeAmountSOL in the config.
- Minimum Balance: Adjust minWalletBalance to set the stopping threshold.
- Slippage Tolerance: Change slippageBps (100 = 1%).

## Troubleshooting

### Common Issues

- **Transaction Failed:** Caused by insufficient SOL, network congestion, or low slippage. The bot retries up to `maxTransactionRetries` times.
- **No Routes Found:** Insufficient token liquidity. The bot automatically skips these tokens.
- **API Errors:** Ensure your pair detection API is operational and returns properly formatted data.

## Disclaimer
This bot is for educational purposes only. The developers are not responsible for any financial losses. Always perform due diligence before trading cryptocurrencies.
