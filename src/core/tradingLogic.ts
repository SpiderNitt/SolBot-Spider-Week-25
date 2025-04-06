import { PairInfo, TradeInfo, BuyResult, SellResult, QuoteResponse } from '../types';
import { getQuote, executeSwap } from '../services/jupiterServices';
import { getTokenBalance } from '../utils/wallet';
import { executeJupiterTransaction } from '../services/transactionServices';
import { tradingState, saveTradeHistory } from './tradingState';
import { getTokenInfo } from '../services/tokenServices';
import { log, logError, logSuccess, logImportant } from '../utils/logger';
import { wallet, connection, getWalletBalance } from '../utils/wallet';
import config from '../config/config';
import axios from 'axios';

// Check for new token pairs from the API
export const checkForNewPairs = async (): Promise<void> => {
  try {
    if (tradingState.isProcessing) {
      log('Already processing a trade, skipping check');
      return;
    }

    tradingState.isProcessing = true;

    // Fetch new pairs from the FastAPI endpoint
    const response = await axios.get(config.pairApiUrl);
    if (response.status === 200 && response.data) {
        //@ts-ignore
      const lastLine = response.data.info; 
      logImportant(`New token detected: ${lastLine}`);

      // Check if we've already traded this token
      const hasTraded = tradingState.tradeHistory.some(
        (trade) => trade.tokenAddress === lastLine
      );

      if (hasTraded) {
        log(`Already traded token: ${lastLine}, skipping`);
        tradingState.isProcessing = false;
        return;
      }

      // Fetch additional token details
      const tokenInfo = await getTokenInfo(lastLine);

      if (tokenInfo) {
        // Create a PairInfo object with the token details
        const newPair: PairInfo = {
          tokenAddress: lastLine,
          symbol: tokenInfo.symbol,
          decimals: tokenInfo.decimals,
          name: tokenInfo.name,
        };

        // Process the new pair
        await processPair(newPair);
      } else {
        logError(`Token details not found for address: ${lastLine}`);
      }
    }
  } catch (error) {
    logError('Error checking for new pairs:', error);
  } finally {
    tradingState.isProcessing = false;
  }
};

// Process a new token pair
export const processPair = async (pair: PairInfo): Promise<void> => {
  logImportant(`Processing new token: ${pair.symbol || pair.tokenAddress}`);

  if (!pair.tokenAddress) {
    logError('Invalid pair data: Token address is missing');
    return;
  }

  // Check if wallet has enough balance
  const balance = await getWalletBalance(wallet);
  if (balance < config.minWalletBalance) {
    logImportant(`Wallet balance too low (${balance.toFixed(4)} SOL). Skipping trade.`);
    return;
  }

  try {
    // Check if token is valid and has liquidity
    const inputAmount = Math.floor(config.defaultTradeAmountSOL * 1e9).toString(); // Convert SOL to lamports

    // Get quote for SOL -> Token
    log(`Getting quote for ${config.defaultTradeAmountSOL} SOL -> ${pair.symbol || pair.tokenAddress}`);
    const quoteResponse = await getQuote(
      config.WSOL_ADDRESS,
      pair.tokenAddress,
      inputAmount,
      'ExactIn'
    );

    if (!quoteResponse) {
      logError(`No routes found for ${pair.symbol || pair.tokenAddress}. Skipping trade.`);
      return;
    }

    log(`Quote received for ${pair.symbol || pair.tokenAddress}`);

    // Execute buy order
    logImportant(`Buying ${pair.symbol || pair.tokenAddress}...`);
    const buyResult = await executeBuyOrder(pair, quoteResponse);
    if (!buyResult.success) {
      logError(`Failed to buy ${pair.symbol || pair.tokenAddress}: ${buyResult.error}`);
      return;
    }

    logSuccess(`Bought ${pair.symbol || pair.tokenAddress} at ${buyResult.price?.toFixed(8)} SOL/token`);

    // Create trade info object
    const tradeInfo: TradeInfo = {
      id: Date.now().toString(),
      tokenAddress: pair.tokenAddress,
      symbol: pair.symbol || pair.tokenAddress,
      buyPrice: buyResult.price!,
      buyAmount: buyResult.amount!,
      buyTimestamp: Date.now(),
      buyTxId: buyResult.txId!,
    };

    // Execute immediate sell with a small delay
    logImportant(`Preparing to sell ${tradeInfo.symbol} immediately...`);
    
    // Small delay to ensure transaction finality
    await new Promise(resolve => setTimeout(resolve, config.sellDelayMs));
    
    // Execute sell
    const sellResult = await executeSellOrder(tradeInfo);
    
    if (sellResult.success) {
      const profitPercentage = ((sellResult.price! - tradeInfo.buyPrice) / tradeInfo.buyPrice) * 100;
      logSuccess(`Sold ${tradeInfo.symbol} at ${sellResult.price?.toFixed(8)} SOL/token (${profitPercentage.toFixed(2)}% profit)`);
      
      // Add to trade history
      tradingState.tradeHistory.push({
        ...tradeInfo,
        sellPrice: sellResult.price!,
        sellTimestamp: Date.now(),
        profit: profitPercentage / 100,
        sellTxId: sellResult.txId!,
      });
      
      saveTradeHistory();
    } else {
      logError(`Failed to sell ${tradeInfo.symbol}: ${sellResult.error}`);
      
      // Add to active trades to try selling later
      tradingState.activeTrades.push(tradeInfo);
      saveTradeHistory();
    }
    
    // Update wallet balance after trades
    await getWalletBalance(wallet);
  } catch (error) {
    logError(`Error processing pair ${pair.symbol || pair.tokenAddress}:`, error);
  }
};

// Execute buy order for a token using Jupiter
export const executeBuyOrder = async (pair: PairInfo, quoteResponse: QuoteResponse): Promise<BuyResult> => {
  try {
    log(`Preparing buy transaction for ${pair.symbol || pair.tokenAddress}`);

    // Step 1: Get the swap instructions
    const swapResult = await executeSwap({
      quoteResponse,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true, // Handle SOL wrapping/unwrapping
    });

    if (!swapResult) {
      throw new Error('Failed to get swap transaction');
    }

    // Step 2: Create and sign transaction
    const { txid } = await executeJupiterTransaction(swapResult, wallet);

    log(`Buy transaction sent with txid: ${txid}`);

    // Wait for confirmation
    await connection.confirmTransaction(txid, 'confirmed');

    log(`Buy transaction confirmed: ${txid}`);

    // Calculate price from the quote
    const inputAmount = parseFloat(quoteResponse.inputAmount) / 1e9; // Convert from lamports to SOL
    const outputAmount = parseFloat(quoteResponse.outputAmount);
    const decimals = pair.decimals || 6;
    const adjustedOutputAmount = outputAmount / Math.pow(10, decimals);
    const price = inputAmount / adjustedOutputAmount; // Price in terms of SOL per token

    // Get actual token balance
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for blockchain to update
    const tokenBalance = await getTokenBalance(wallet, pair.tokenAddress);

    log(`Token balance after purchase: ${tokenBalance}`);

    return {
      success: true,
      price: price,
      amount: tokenBalance,
      txId: txid,
    };
  } catch (error: any) {
    logError(`Error buying ${pair.symbol || pair.tokenAddress}:`, error);
    return { success: false, error: error.message };
  }
};

// Execute sell order using Jupiter API
export const executeSellOrder = async (tradeInfo: TradeInfo): Promise<SellResult> => {
  try {
    log(`Preparing to sell ${tradeInfo.symbol}`);

    // Get token balance
    const tokenBalance = await getTokenBalance(wallet, tradeInfo.tokenAddress);
    if (tokenBalance <= 0) {
      return { success: false, error: 'No token balance' };
    }

    log(`Current balance of ${tradeInfo.symbol}: ${tokenBalance}`);

    // Convert to raw amount based on decimals (default to 6 if unknown)
    const tokenInfo = tradingState.tokenList.find((t: any) => t.address === tradeInfo.tokenAddress);
    const decimals = tokenInfo ? tokenInfo.decimals : 6;
    const rawAmount = Math.floor(tokenBalance * Math.pow(10, decimals)).toString();

    log(`Preparing to sell ${tokenBalance} tokens (raw amount: ${rawAmount})`);

    // Get quote for Token -> SOL
    const quoteResponse = await getQuote(
      tradeInfo.tokenAddress,
      config.WSOL_ADDRESS,
      rawAmount,
      'ExactIn'
    );

    if (!quoteResponse) {
      return { success: false, error: 'No routes found for selling' };
    }

    // Calculate current price
    const outputAmount = parseFloat(quoteResponse.outputAmount) / 1e9; // Convert from lamports to SOL
    const inputAmount = parseFloat(quoteResponse.inputAmount);
    const adjustedInputAmount = inputAmount / Math.pow(10, decimals);
    const currentPrice = outputAmount / adjustedInputAmount;

    log(`Current sell price: ${currentPrice.toFixed(8)} SOL per token`);

    // Execute sell transaction
    const swapResult = await executeSwap({
      quoteResponse,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
    });

    if (!swapResult) {
      return { success: false, error: 'Failed to get swap transaction' };
    }

    const { txid } = await executeJupiterTransaction(swapResult, wallet);

    log(`Sell transaction sent with txid: ${txid}`);

    // Wait for confirmation
    await connection.confirmTransaction(txid, 'confirmed');

    log(`Sell transaction confirmed: ${txid}`);

    // Verify balance is zero (or close to zero due to dust)
    const afterSellBalance = await getTokenBalance(wallet, tradeInfo.tokenAddress);
    log(`Balance after selling: ${afterSellBalance}`);

    return { 
      success: true, 
      txId: txid,
      price: currentPrice
    };
  } catch (error: any) {
    logError(`Error selling ${tradeInfo.symbol}:`, error);
    return { success: false, error: error.message };
  }
};

// Cleanup function to attempt selling any tokens that failed to sell
export const cleanupActiveTrades = async (): Promise<void> => {
  if (tradingState.activeTrades.length === 0) {
    return;
  }

  logImportant(`Attempting to sell ${tradingState.activeTrades.length} tokens from previous trades`);

  for (const trade of [...tradingState.activeTrades]) {
    try {
      log(`Attempting to sell ${trade.symbol}`);
      const sellResult = await executeSellOrder(trade);
      
      if (sellResult.success) {
        logSuccess(`Successfully sold ${trade.symbol}`);
        
        // Add to trade history
        tradingState.tradeHistory.push({
          ...trade,
          sellPrice: sellResult.price!,
          sellTimestamp: Date.now(),
          profit: (sellResult.price! - trade.buyPrice) / trade.buyPrice,
          sellTxId: sellResult.txId!,
        });
        
        // Remove from active trades
        tradingState.activeTrades = tradingState.activeTrades.filter(t => t.id !== trade.id);
        saveTradeHistory();
      } else {
        logError(`Failed to sell ${trade.symbol}: ${sellResult.error}`);
      }
    } catch (error) {
      logError(`Error processing cleanup for ${trade.symbol}:`, error);
    }
  }
};