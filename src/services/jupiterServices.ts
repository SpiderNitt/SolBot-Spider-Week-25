import axios from 'axios';
import { QuoteResponse, SwapRequest, SwapResponse } from '../types';
import config from '../config/config';
import { logError, log } from '../utils/logger';

// Get quote from Jupiter API
export const getQuote = async (
  inputMint: string,
  outputMint: string,
  amount: string,
  swapMode: string = 'ExactIn'
): Promise<QuoteResponse | null> => {
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

    const response = await axios.get(url, { params });
    if (response.status === 200) {
      return response.data as QuoteResponse;
    }

    return null;
  } catch (error) {
    logError('Error getting quote:', error);
    return null;
  }
};

// Execute a swap using Jupiter API
export const executeSwap = async (swapRequest: SwapRequest): Promise<SwapResponse | null> => {
  try {
    const url = `${config.jupiterApiUrl}/swap`;
    const response = await axios.post(url, swapRequest);

    if (response.status === 200) {
      return response.data as SwapResponse;
    }

    return null;
  } catch (error) {
    logError('Error executing swap:', error);
    return null;
  }
};