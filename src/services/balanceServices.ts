import { Connection, PublicKey } from '@solana/web3.js';
import { tradingState } from '../core/tradingState';
import { logImportant, logError } from '../utils/logger';

// Get wallet SOL balance
export const getWalletBalance = async (
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<number> => {
  try {
    const balance = await connection.getBalance(walletPublicKey);
    tradingState.walletBalance = balance / 1e9; // Convert lamports to SOL
    logImportant(`Current wallet balance: ${tradingState.walletBalance.toFixed(4)} SOL`);
    return tradingState.walletBalance;
  } catch (error) {
    logError('Error getting wallet balance:', error);
    return 0;
  }
};

// Get token balance
export const getTokenBalance = async (
  connection: Connection,
  walletPublicKey: PublicKey,
  tokenAddress: string
): Promise<number> => {
  try {
    const tokenPublicKey = new PublicKey(tokenAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
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