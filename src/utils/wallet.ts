import { Keypair, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import config from '../config/config';
import { logError, logImportant } from './logger';

// Load wallet from private key
export const loadWallet = (privateKeyString: string): Keypair => {
  try {
    const cleanPrivateKey = privateKeyString.trim();
    const decodedKey = bs58.decode(cleanPrivateKey);
    return Keypair.fromSecretKey(decodedKey);
  } catch (error) {
    logError('Error loading wallet:', error);
    throw new Error('Failed to load wallet: Invalid private key format');
  }
};

// Initialize Solana connection
export const connection = new Connection(config.rpcEndpoint, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Get wallet SOL balance
export const getWalletBalance = async (wallet: Keypair): Promise<number> => {
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    const solBalance = balance / 1e9; // Convert lamports to SOL
    logImportant(`Current wallet balance: ${solBalance.toFixed(4)} SOL`);
    return solBalance;
  } catch (error) {
    logError('Error getting wallet balance:', error);
    return 0;
  }
};

// Get token balance
export const getTokenBalance = async (wallet: Keypair, tokenAddress: string): Promise<number> => {
  try {
    //@ts-ignore
    const tokenPublicKey = new PublicKey(tokenAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
      mint: tokenPublicKey,
    });

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    const tokenAccount = tokenAccounts.value[0];
    const amount = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
    return amount;
  } catch (error) {
    logError(`Error getting token balance for ${tokenAddress}:`, error);
    return 0;
  }
};

// Load wallet
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable is required');
}

export const wallet = loadWallet(PRIVATE_KEY);