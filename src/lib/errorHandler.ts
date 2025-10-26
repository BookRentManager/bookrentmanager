/**
 * Centralized error handling utility
 * Logs detailed errors only in development, returns safe messages for production
 */

interface ErrorResult {
  message: string;
  code: string;
}

export function handleError(error: any, userMessage: string): ErrorResult {
  // Only log detailed errors in development
  if (import.meta.env.DEV) {
    console.error('Error details:', error);
  }
  
  return {
    message: userMessage,
    code: error?.code || 'UNKNOWN'
  };
}

export function logError(context: string, error: any): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
}
