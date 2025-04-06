import * as fs from 'fs';
import { TradingState, TradeInfo, TradeHistoryItem } from '../types';
import config from '../config/config';
import { log, logError } from '../utils/logger';
import axios from 'axios';

// Initialize trading state
export const tradingState: TradingState = {
  activeTrades: [],
  tradeHistory: [],
  walletBalance: 0,
  isProcessing: false,
  tokenList: [],
};

// Initialize token list
export const initTokenList = async (): Promise<boolean> => {
  try {
    log('Loading token list...');
    const tokenListResponse = await axios.get('https://token.jup.ag/strict');
    //@ts-ignore
    tradingState.tokenList = tokenListResponse.data;
    log(`Token list loaded with ${tradingState.tokenList.length} tokens`);
    return true;
  } catch (error) {
    logError('Failed to load token list:', error);
    return false;
  }
};

// Load trade history if exists
export const loadTradeHistory = (): void => {
  try {
    if (fs.existsSync(config.logFilePath)) {
      const data = fs.readFileSync(config.logFilePath, 'utf8');
      const parsed = JSON.parse(data);
      tradingState.tradeHistory = parsed.tradeHistory || [];
      tradingState.activeTrades = parsed.activeTrades || [];
      log(`Loaded ${tradingState.tradeHistory.length} historical trades and ${tradingState.activeTrades.length} active trades`);
    }
  } catch (error) {
    logError('Error loading trade history:', error);
  }
};

// Save trading state to file
export const saveTradeHistory = (): void => {
  try {
    fs.writeFileSync(
      config.logFilePath,
      JSON.stringify(
        {
          tradeHistory: tradingState.tradeHistory,
          activeTrades: tradingState.activeTrades,
        },
        null,
        2
      )
    );
    log('Trade history saved to file');
  } catch (error) {
    logError('Error saving trade history:', error);
  }
};

// Update wallet balance in trading state
export const updateWalletBalance = (balance: number): void => {
  tradingState.walletBalance = balance;
};