import { logImportant, logError } from './utils/logger';
import { wallet, getWalletBalance } from './utils/wallet';
import { initTokenList, loadTradeHistory } from './core/tradingState';
import { checkForNewPairs, cleanupActiveTrades } from './core/tradingLogic';
import config from './config/config';

// Main bot loop
const startBot = async (): Promise<void> => {
  logImportant('Starting Solana Trading Bot');
  logImportant('Strategy: Buy new tokens and sell immediately');

  // Load trade history
  loadTradeHistory();

  // Initialize token list
  const tokenListInitialized = await initTokenList();
  if (!tokenListInitialized) {
    logError('Failed to initialize token list. Exiting.');
    process.exit(1);
  }

  // Check wallet balance
  await getWalletBalance(wallet);

  // Try to sell any active trades from previous session
  await cleanupActiveTrades();

  // Start checking for new pairs at regular intervals
  logImportant(`Monitoring for new pairs every ${config.pollingInterval / 1000} seconds...`);
  setInterval(checkForNewPairs, config.pollingInterval);

  // Also set up a regular balance check
  setInterval(() => getWalletBalance(wallet), 60000); // Check balance every minute
};

logImportant(`Bot started with wallet: ${wallet.publicKey.toString()}`);

startBot().catch((error) => {
  logError('Fatal error starting bot:', error);
  process.exit(1);
});