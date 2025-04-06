"use strict";
// Solana Trading Bot for New Pairs with Jupiter API v6 Integration
// Automatically buys new pairs and sells at 20% profit target
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const bs58_1 = __importDefault(require("bs58"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configuration
const config = {
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    jupiterApiUrl: 'https://quote-api.jup.ag/v6',
    pairApiUrl: 'https://3fff-14-139-162-2.ngrok-free.app/',
    pollingInterval: 15000, // Check for new pairs every 10 seconds
    profitTarget: 0.2, // 20% profit target
    slippageBps: 100, // 1% slippage tolerance (in basis points)
    maxTransactionRetries: 3,
    // Default SOL amount to use for each trade (in SOL)
    defaultTradeAmountSOL: 0.01,
    // Don't trade if wallet balance falls below this (in SOL)
    minWalletBalance: 0.02,
    logFilePath: './trading_log.json',
    // Constants for Jupiter
    WSOL_ADDRESS: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    priceCheckInterval: 15000, // Check prices every 15 seconds
    tokenListUrl: 'https://token.jup.ag/strict',
};
const loadWallet = (privateKeyString) => {
    try {
        // Remove any whitespace and validate key format
        const cleanPrivateKey = privateKeyString.trim();
        // Decode the base58 private key
        const decodedKey = bs58_1.default.decode(cleanPrivateKey);
        // Create Keypair from decoded key
        return web3_js_1.Keypair.fromSecretKey(decodedKey);
    }
    catch (error) {
        console.error('Error loading wallet:', error);
        throw new Error('Failed to load wallet: Invalid private key format');
    }
};
// Usage
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
}
const wallet = loadWallet(PRIVATE_KEY);
const connection = new web3_js_1.Connection(config.rpcEndpoint, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
});
console.log(`Bot wallet address: ${wallet.publicKey.toString()}`);
// Initialize trading state
const tradingState = {
    activeTrades: [],
    tradeHistory: [],
    walletBalance: 0,
    isProcessing: false,
    tokenList: [],
};
// Initialize token list
const initTokenList = async () => {
    try {
        console.log('Loading token list...');
        const tokenListResponse = await axios_1.default.get(config.tokenListUrl);
        //@ts-ignore
        tradingState.tokenList = tokenListResponse.data;
        console.log(`Token list loaded with ${tradingState.tokenList.length} tokens`);
        return true;
    }
    catch (error) {
        console.error('Failed to load token list:', error);
        return false;
    }
};
// Load trade history if exists
const loadTradeHistory = () => {
    try {
        if (fs.existsSync(config.logFilePath)) {
            const data = fs.readFileSync(config.logFilePath, 'utf8');
            const parsed = JSON.parse(data);
            tradingState.tradeHistory = parsed.tradeHistory || [];
            tradingState.activeTrades = parsed.activeTrades || [];
        }
    }
    catch (error) {
        console.error('Error loading trade history:', error);
    }
};
// Save trading state to file
const saveTradeHistory = () => {
    try {
        fs.writeFileSync(config.logFilePath, JSON.stringify({
            tradeHistory: tradingState.tradeHistory,
            activeTrades: tradingState.activeTrades,
        }, null, 2));
    }
    catch (error) {
        console.error('Error saving trade history:', error);
    }
};
// Get wallet SOL balance
const getWalletBalance = async () => {
    try {
        const balance = await connection.getBalance(wallet.publicKey);
        tradingState.walletBalance = balance / 1e9; // Convert lamports to SOL
        console.log(`Current wallet balance: ${tradingState.walletBalance} SOL`);
        return tradingState.walletBalance;
    }
    catch (error) {
        console.error('Error getting wallet balance:', error);
        return 0;
    }
};
// Get token balance
const getTokenBalance = async (tokenAddress) => {
    try {
        const tokenPublicKey = new web3_js_1.PublicKey(tokenAddress);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
            mint: tokenPublicKey,
        });
        if (tokenAccounts.value.length === 0) {
            return 0;
        }
        const tokenAccount = tokenAccounts.value[0];
        const amount = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
        return amount;
    }
    catch (error) {
        console.error(`Error getting token balance for ${tokenAddress}:`, error);
        return 0;
    }
};
// Fetch token metadata on-chain
const fetchTokenMetadata = async (tokenAddress) => {
    try {
        const tokenPublicKey = new web3_js_1.PublicKey(tokenAddress);
        const tokenAccountInfo = await connection.getAccountInfo(tokenPublicKey);
        if (tokenAccountInfo) {
            const data = tokenAccountInfo.data;
            // Decode token metadata (example: MINT layout)
            const decimals = data[44]; // Decimals are at offset 44 in the MINT layout
            const symbol = 'Unknown'; // Symbol is not stored on-chain, so we use a placeholder
            const name = 'Unknown'; // Name is not stored on-chain, so we use a placeholder
            return {
                address: tokenAddress,
                decimals,
                symbol,
                name,
            };
        }
        else {
            console.log(`Token account not found for address: ${tokenAddress}`);
            return null;
        }
    }
    catch (error) {
        console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
        return null;
    }
};
// Check for new token pairs from the API
const checkForNewPairs = async () => {
    try {
        if (tradingState.isProcessing) {
            console.log('Already processing a trade, skipping check');
            return;
        }
        tradingState.isProcessing = true;
        // Fetch new pairs from the FastAPI endpoint
        const response = await axios_1.default.get(config.pairApiUrl);
        if (response.status === 200 && response.data) {
            //@ts-ignore
            const lastLine = response.data.last_line; // Extract the "last_line" value
            console.log(`New token address detected: ${lastLine}`);
            // Check if we're already trading this token
            const isAlreadyTrading = tradingState.activeTrades.some((trade) => trade.tokenAddress === lastLine);
            if (!isAlreadyTrading) {
                // Fetch additional token details from the Jupiter token list
                let tokenInfo = tradingState.tokenList.find((token) => token.address === lastLine);
                if (!tokenInfo) {
                    // If token details are not found in the Jupiter token list, fetch metadata on-chain
                    console.log('Token details not found in Jupiter token list. Fetching on-chain metadata...');
                    tokenInfo = await fetchTokenMetadata(lastLine);
                }
                if (tokenInfo) {
                    // Create a PairInfo object with the token details
                    const newPair = {
                        tokenAddress: lastLine,
                        symbol: tokenInfo.symbol,
                        decimals: tokenInfo.decimals,
                        name: tokenInfo.name,
                    };
                    // Process the new pair
                    await processPair(newPair);
                }
                else {
                    console.log(`Token details not found for address: ${lastLine}`);
                }
            }
            else {
                console.log(`Already trading token: ${lastLine}`);
            }
        }
    }
    catch (error) {
        console.error('Error checking for new pairs:', error);
    }
    finally {
        tradingState.isProcessing = false;
    }
};
// Process a new token pair
const processPair = async (pair) => {
    // Simple validation
    console.log('\n=== New Pair Detected ===');
    console.log(`Token Address: ${pair.tokenAddress}`);
    console.log(`Symbol: ${pair.symbol || 'Unknown'}`);
    console.log(`Name: ${pair.name || 'Unknown'}`);
    console.log(`Decimals: ${pair.decimals || 'Using fallback (6)'}`);
    console.log('========================\n');
    if (!pair.tokenAddress) {
        console.error('Invalid pair data: Token address is missing');
        return;
    }
    console.log(`Processing new pair: ${pair.symbol || pair.tokenAddress}`);
    // Check if wallet has enough balance
    const balance = await getWalletBalance();
    if (balance < config.minWalletBalance) {
        console.log(`Wallet balance too low (${balance} SOL). Skipping trade.`);
        return;
    }
    try {
        // Check if token is valid and has liquidity
        const inputAmount = Math.floor(config.defaultTradeAmountSOL * 1e9).toString(); // Convert SOL to lamports
        // Get quote for SOL -> Token
        const quoteResponse = await getQuote(config.WSOL_ADDRESS, pair.tokenAddress, inputAmount, 'ExactIn');
        if (!quoteResponse) {
            console.log(`No routes found for ${pair.symbol || pair.tokenAddress}. Skipping trade.`);
            return;
        }
        console.log(`Quote Response for ${pair.symbol || pair.tokenAddress}:`, quoteResponse);
        // Execute buy order
        const buyResult = await executeBuyOrder(pair, quoteResponse);
        if (!buyResult.success) {
            console.error(`Failed to buy ${pair.symbol || pair.tokenAddress}:`, buyResult.error);
            return;
        }
        console.log(`Successfully bought ${pair.symbol || pair.tokenAddress}`);
        // Add to active trades
        const tradeInfo = {
            id: Date.now().toString(),
            tokenAddress: pair.tokenAddress,
            symbol: pair.symbol || pair.tokenAddress, // Use token address if symbol is missing
            buyPrice: buyResult.price,
            buyAmount: buyResult.amount,
            buyTimestamp: Date.now(),
            targetPrice: buyResult.price * (1 + config.profitTarget),
            buyTxId: buyResult.txId,
        };
        tradingState.activeTrades.push(tradeInfo);
        saveTradeHistory();
        // Start monitoring this trade
        monitorTrade(tradeInfo);
    }
    catch (error) {
        console.error(`Error processing pair ${pair.symbol || pair.tokenAddress}:`, error);
    }
};
// Get quote from Jupiter API
const getQuote = async (inputMint, outputMint, amount, swapMode = 'ExactIn') => {
    try {
        const url = `${config.jupiterApiUrl}/quote`;
        const params = {
            inputMint,
            outputMint,
            amount,
            slippageBps: config.slippageBps.toString(),
            swapMode,
            onlyDirectRoutes: false,
        };
        const response = await axios_1.default.get(url, { params });
        if (response.status === 200) {
            return response.data;
        }
        return null;
    }
    catch (error) {
        console.error('Error getting quote:', error);
        return null;
    }
};
// Execute buy order for a token using Jupiter
const executeBuyOrder = async (pair, quoteResponse) => {
    try {
        console.log(`Executing buy order for ${pair.symbol || pair.tokenAddress} using Jupiter API...`);
        // Step 1: Get the swap instructions
        const swapResult = await executeSwap({
            quoteResponse,
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true, // Handle SOL wrapping/unwrapping
        });
        if (!swapResult) {
            console.error('Failed to get swap transaction');
            return { success: false, error: 'Failed to get swap transaction' };
        }
        console.log('Swap Result:', swapResult);
        // Step 2: Create and sign transaction
        const { txid } = await executeJupiterTransaction(swapResult);
        console.log(`Transaction sent with txid: ${txid}`);
        // Wait for confirmation
        await connection.confirmTransaction(txid, 'confirmed');
        console.log(`Transaction confirmed: ${txid}`);
        // Calculate price from the quote
        const inputAmount = parseFloat(quoteResponse.inputAmount);
        const outputAmount = parseFloat(quoteResponse.outputAmount);
        const price = inputAmount / outputAmount; // Price in terms of SOL per token
        // Get actual token balance
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for blockchain to update
        const tokenBalance = await getTokenBalance(pair.tokenAddress);
        console.log(`Token balance after purchase: ${tokenBalance}`);
        return {
            success: true,
            price: price,
            amount: tokenBalance, // Actual amount received
            txId: txid,
        };
    }
    catch (error) {
        console.error(`Error buying ${pair.symbol || pair.tokenAddress}:`, error);
        return { success: false, error: error.message };
    }
};
// Execute a swap using Jupiter API
const executeSwap = async (swapRequest) => {
    try {
        const url = `${config.jupiterApiUrl}/swap`;
        const response = await axios_1.default.post(url, swapRequest);
        if (response.status === 200) {
            return response.data;
        }
        return null;
    }
    catch (error) {
        console.error('Error executing swap:', error);
        return null;
    }
};
// Execute a Jupiter transaction with retries
const executeJupiterTransaction = async (swapResult) => {
    let attempt = 0;
    while (attempt < config.maxTransactionRetries) {
        try {
            // Get the serialized transaction
            const { swapTransaction } = swapResult;
            // Deserialize the transaction
            let transaction;
            let txid;
            // Check if the transaction is versioned
            const isVersioned = swapTransaction.startsWith('AQAA'); // Versioned transactions start with 'AQAA'
            if (isVersioned) {
                // Handle versioned transaction
                const serializedTransaction = Buffer.from(swapTransaction, 'base64');
                transaction = web3_js_1.VersionedTransaction.deserialize(serializedTransaction);
                // Sign the transaction
                transaction.sign([wallet]);
                // Send the transaction
                txid = await connection.sendTransaction(transaction);
            }
            else {
                // Handle legacy transaction
                const serializedTransaction = Buffer.from(swapTransaction, 'base64');
                transaction = web3_js_1.Transaction.from(serializedTransaction);
                // Sign the transaction
                transaction.sign(wallet);
                // Send the transaction
                txid = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
            }
            console.log(`Transaction sent with txid: ${txid}`);
            // Wait for confirmation
            await connection.confirmTransaction(txid, 'confirmed');
            console.log(`Transaction confirmed: ${txid}`);
            return { txid };
        }
        catch (error) {
            console.error(`Transaction attempt ${attempt + 1} failed:`, error);
            attempt++;
            if (attempt >= config.maxTransactionRetries) {
                throw new Error(`Failed after ${config.maxTransactionRetries} attempts: ${error.message}`);
            }
            // Exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error('Failed to execute transaction after retries');
};
// Monitor a trade and sell when it reaches the profit target
const monitorTrade = async (tradeInfo) => {
    console.log(`Starting to monitor ${tradeInfo.symbol} for 20% profit target`);
    const checkInterval = setInterval(async () => {
        try {
            // Check if this trade is still active (might have been sold manually)
            const isActive = tradingState.activeTrades.some((t) => t.id === tradeInfo.id);
            if (!isActive) {
                clearInterval(checkInterval);
                return;
            }
            // Get current price using Jupiter API
            const currentPrice = await getTokenPrice(tradeInfo.tokenAddress);
            if (currentPrice === null) {
                console.log(`Couldn't get price for ${tradeInfo.symbol}, will try again later`);
                return;
            }
            // Calculate profit percentage - note we're looking for price to increase
            const profitPercentage = (currentPrice - tradeInfo.buyPrice) / tradeInfo.buyPrice;
            console.log(`${tradeInfo.symbol} current price: ${currentPrice}, profit: ${(profitPercentage * 100).toFixed(2)}%`);
            // If target reached, sell
            if (profitPercentage >= config.profitTarget) {
                clearInterval(checkInterval);
                await executeSellOrder(tradeInfo, currentPrice, profitPercentage);
            }
        }
        catch (error) {
            console.error(`Error monitoring ${tradeInfo.symbol}:`, error);
        }
    }, config.priceCheckInterval);
};
// Get token price using Jupiter API
const getTokenPrice = async (tokenAddress) => {
    try {
        // We'll calculate price by getting a quote for a small amount of the token
        // Try to find routes from token to SOL (for selling)
        // We use a small amount to just get the price
        const amountToQuote = '1000000'; // 1 unit of token (adjusted for 6 decimals)
        const quoteResponse = await getQuote(tokenAddress, config.WSOL_ADDRESS, amountToQuote, 'ExactIn');
        if (!quoteResponse) {
            return null;
        }
        // Calculate price in SOL per token
        const outputAmount = parseFloat(quoteResponse.outputAmount);
        const inputAmount = parseFloat(quoteResponse.inputAmount);
        const price = outputAmount / inputAmount;
        return price;
    }
    catch (error) {
        console.error(`Error getting price for ${tokenAddress}:`, error);
        return null;
    }
};
// Execute sell order using Jupiter API
const executeSellOrder = async (tradeInfo, currentPrice, profitPercentage) => {
    try {
        console.log(`Selling ${tradeInfo.symbol} at ${currentPrice} with ${(profitPercentage * 100).toFixed(2)}% profit`);
        // Get token balance
        const tokenBalance = await getTokenBalance(tradeInfo.tokenAddress);
        if (tokenBalance <= 0) {
            console.log(`No balance for ${tradeInfo.symbol}, removing from active trades`);
            tradingState.activeTrades = tradingState.activeTrades.filter((t) => t.id !== tradeInfo.id);
            saveTradeHistory();
            return { success: false, error: 'No token balance' };
        }
        // Convert to raw amount based on decimals (default to 6 if unknown)
        const tokenInfo = tradingState.tokenList.find((t) => t.address === tradeInfo.tokenAddress);
        const decimals = tokenInfo ? tokenInfo.decimals : 6;
        const rawAmount = Math.floor(tokenBalance * Math.pow(10, decimals)).toString();
        // Get quote for Token -> SOL
        const quoteResponse = await getQuote(tradeInfo.tokenAddress, config.WSOL_ADDRESS, rawAmount, 'ExactIn');
        if (!quoteResponse) {
            console.log(`No routes found for selling ${tradeInfo.symbol}`);
            return { success: false, error: 'No routes found' };
        }
        // Execute sell transaction
        const swapResult = await executeSwap({
            quoteResponse,
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
        });
        if (!swapResult) {
            return { success: false, error: 'Failed to get swap transaction' };
        }
        const { txid } = await executeJupiterTransaction(swapResult);
        // If successful, update trade history and remove from active trades
        // Add to trade history
        tradingState.tradeHistory.push({
            ...tradeInfo,
            sellPrice: currentPrice,
            sellTimestamp: Date.now(),
            profit: profitPercentage,
            sellTxId: txid,
        });
        // Remove from active trades
        tradingState.activeTrades = tradingState.activeTrades.filter((t) => t.id !== tradeInfo.id);
        // Save updated state
        saveTradeHistory();
        console.log(`Successfully sold ${tradeInfo.symbol} with ${(profitPercentage * 100).toFixed(2)}% profit`);
        return { success: true, txId: txid };
    }
    catch (error) {
        console.error(`Error selling ${tradeInfo.symbol}:`, error);
        return { success: false, error: error.message };
    }
};
// Main bot loop
const startBot = async () => {
    console.log('Starting Solana trading bot with Jupiter API v6 integration...');
    // Load trade history
    loadTradeHistory();
    // Initialize token list
    const tokenListInitialized = await initTokenList();
    if (!tokenListInitialized) {
        console.error('Failed to initialize token list. Exiting.');
        process.exit(1);
    }
    // Check wallet balance
    await getWalletBalance();
    // Start checking for new pairs at regular intervals
    setInterval(checkForNewPairs, config.pollingInterval);
    // Also resume monitoring any active trades from previous sessions
    tradingState.activeTrades.forEach((trade) => {
        monitorTrade(trade);
    });
    console.log('Bot is running and monitoring for new pairs...');
};
startBot().catch((error) => {
    console.error('Fatal error starting bot:', error);
    process.exit(1);
});
