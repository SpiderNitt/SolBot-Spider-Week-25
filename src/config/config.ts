import dotenv from 'dotenv';

dotenv.config();

// Configuration
const config = {
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  jupiterApiUrl: 'https://quote-api.jup.ag/v6',
  pairApiUrl: 'https://4db5-14-139-162-2.ngrok-free.app/',
  pollingInterval: 10000, // Check for new pairs every 10 seconds
  slippageBps: 100, // 1% slippage tolerance (in basis points)
  maxTransactionRetries: 3,
  defaultTradeAmountSOL: 0.01, // Default SOL amount to use for each trade (in SOL)
  minWalletBalance: 0.02, // Don't trade if wallet balance falls below this (in SOL)
  logFilePath: './trading_log.json',
  WSOL_ADDRESS: 'So11111111111111111111111111111111111111112', // Wrapped SOL
  sellDelayMs: 2000, // Small delay between buy and sell to ensure transaction finality
  debugMode: false, // Set this to true for verbose logging, false for minimal logging
};

export default config;