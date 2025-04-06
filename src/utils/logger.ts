import config from '../config/config';

// Helper function for logging based on debug mode
export const log = (message: string, data?: any): void => {
  if (config.debugMode || data === undefined) {
    if (data) {
      console.log(`[INFO] ${message}`, data);
    } else {
      console.log(`[INFO] ${message}`);
    }
  }
};

export const logError = (message: string, error?: any): void => {
  if (error) {
    console.error(`[ERROR] ${message}`, error);
  } else {
    console.error(`[ERROR] ${message}`);
  }
};

export const logSuccess = (message: string): void => {
  console.log(`[SUCCESS] ${message}`);
};

export const logImportant = (message: string): void => {
  console.log(`\n[IMPORTANT] ${message}\n`);
};