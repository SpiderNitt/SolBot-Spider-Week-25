export interface PairInfo {
    tokenAddress: string; // This will be the "last_line" value
    symbol?: string;      // Will be fetched from the token list or on-chain
    decimals?: number;    // Will be fetched from the token list or on-chain
    name?: string;        // Will be fetched from the token list or on-chain
  }
  
  export interface TradeInfo {
    id: string;
    tokenAddress: string;
    symbol: string;
    buyPrice: number;
    buyAmount: number;
    buyTimestamp: number;
    buyTxId: string;
  }
  
  export interface TradeHistoryItem extends TradeInfo {
    sellPrice: number;
    sellTimestamp: number;
    profit: number;
    sellTxId: string;
  }
  
  export interface TradingState {
    activeTrades: TradeInfo[];
    tradeHistory: TradeHistoryItem[];
    walletBalance: number;
    isProcessing: boolean;
    tokenList: any[];
  }
  
  export interface BuyResult {
    success: boolean;
    price?: number;
    amount?: number;
    txId?: string;
    error?: string;
  }
  
  export interface SellResult {
    success: boolean;
    txId?: string;
    price?: number;
    error?: string;
  }
  
  export interface TokenInfo {
    decimals: number;
    address: string;
    symbol: string;
    name: string;
  }
  
  export interface QuoteResponse {
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    routes: Route[];
    contextSlot: number;
    timeTaken: number;
  }
  
  export interface Route {
    inAmount: string;
    outAmount: string;
    amount: string;
    otherAmountThreshold: string;
    swapMode: string;
    priceImpactPct: number;
    marketInfos: any[];
  }
  
  export interface SwapRequest {
    quoteResponse: QuoteResponse;
    userPublicKey: string;
    wrapAndUnwrapSol?: boolean;
  }
  
  export interface SwapResponse {
    swapTransaction: string;
    versionedTransaction?: boolean;
  }