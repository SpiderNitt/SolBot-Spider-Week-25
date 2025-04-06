import { Connection, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';
import { SwapResponse } from '../types';
import { connection } from '../utils/wallet';
import { log, logError } from '../utils/logger';
import config from '../config/config';

// Execute a Jupiter transaction with retries
export const executeJupiterTransaction = async (
  swapResult: SwapResponse,
  wallet: Keypair
): Promise<{ txid: string }> => {
  let attempt = 0;

  while (attempt < config.maxTransactionRetries) {
    try {
      // Get the serialized transaction
      const { swapTransaction } = swapResult;

      // Deserialize the transaction
      let transaction;
      let txid: string;

      // Check if the transaction is versioned
      const isVersioned = swapTransaction.startsWith('AQAA'); // Versioned transactions start with 'AQAA'
      if (isVersioned) {
        // Handle versioned transaction
        const serializedTransaction = Buffer.from(swapTransaction, 'base64');
        transaction = VersionedTransaction.deserialize(serializedTransaction);

        // Sign the transaction
        transaction.sign([wallet]);

        // Send the transaction
        txid = await connection.sendTransaction(transaction);
      } else {
        // Handle legacy transaction
        const serializedTransaction = Buffer.from(swapTransaction, 'base64');
        transaction = Transaction.from(serializedTransaction);

        // Sign the transaction
        transaction.sign(wallet);

        // Send the transaction
        txid = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
      }

      log(`Transaction sent with txid: ${txid}`);

      // Wait for confirmation
      await connection.confirmTransaction(txid, 'confirmed');

      log(`Transaction confirmed: ${txid}`);

      return { txid };
    } catch (error: any) {
      logError(`Transaction attempt ${attempt + 1} failed:`, error);
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