import { PublicKey } from '@solana/web3.js';
import { TokenInfo } from '../types';
import { connection } from '../utils/wallet';
import { log, logError } from '../utils/logger';
import { tradingState } from '../core/tradingState';

// Fetch token metadata on-chain
export const fetchTokenMetadata = async (tokenAddress: string): Promise<TokenInfo | null> => {
  try {
    const tokenPublicKey = new PublicKey(tokenAddress);
    const tokenAccountInfo = await connection.getAccountInfo(tokenPublicKey);

    if (tokenAccountInfo) {
      const data = tokenAccountInfo.data;
      const decimals = data[44]; // Decimals are at offset 44 in the MINT layout
      const symbol = 'Unknown'; // Symbol is not stored on-chain
      const name = 'Unknown'; // Name is not stored on-chain

      return {
        address: tokenAddress,
        decimals,
        symbol,
        name,
      };
    } else {
      log(`Token account not found for address: ${tokenAddress}`);
      return null;
    }
  } catch (error) {
    logError(`Error fetching token metadata for ${tokenAddress}:`, error);
    return null;
  }
};

// Find token info from the loaded token list
export const findTokenInfo = (tokenAddress: string): TokenInfo | null => {
  const tokenInfo = tradingState.tokenList.find(
    (token: TokenInfo) => token.address === tokenAddress
  );
  
  return tokenInfo || null;
};

// Get token info from list or fetch from chain
export const getTokenInfo = async (tokenAddress: string): Promise<TokenInfo | null> => {
  let tokenInfo = findTokenInfo(tokenAddress);
  
  if (!tokenInfo) {
    log('Token details not found in Jupiter token list. Fetching on-chain metadata...');
    tokenInfo = await fetchTokenMetadata(tokenAddress);
  }
  
  return tokenInfo;
};