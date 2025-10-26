/**
 * Secure logging utility for Edge Functions
 * Prevents sensitive data exposure in production logs
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface SanitizedData {
  [key: string]: any;
}

// Fields that should never be logged in production
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'api_key',
  'secret',
  'authorization',
  'credit_card',
  'cvv',
  'ssn',
  'full_card_number'
];

// Fields to anonymize in production (keep format, hide actual value)
const PII_FIELDS = [
  'email',
  'phone',
  'customer_name',
  'client_name',
  'guest_name',
  'billing_address',
  'postfinance_transaction_id',
  'magnolia_transaction_id'
];

/**
 * Anonymizes sensitive data for production logging
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized: SanitizedData = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();

    // Remove sensitive fields completely
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Anonymize PII fields
    if (PII_FIELDS.some(field => lowerKey.includes(field))) {
      const value = sanitized[key];
      if (typeof value === 'string') {
        if (value.includes('@')) {
          // Email: show domain only
          sanitized[key] = `***@${value.split('@')[1] || 'domain.com'}`;
        } else if (value.match(/^\+?\d+$/)) {
          // Phone: show last 4 digits
          sanitized[key] = `***${value.slice(-4)}`;
        } else {
          // Other PII: show length only
          sanitized[key] = `[${value.length} chars]`;
        }
      }
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Determines if we're in production environment
 */
function isProduction(): boolean {
  const env = Deno.env.get('ENVIRONMENT') || Deno.env.get('DENO_ENV');
  return env === 'production' || env === 'prod';
}

/**
 * Secure logging function
 * @param level - Log level (info, warn, error, debug)
 * @param message - Log message (always logged)
 * @param data - Additional data (sanitized in production)
 */
export function secureLog(level: LogLevel, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  
  if (isProduction()) {
    // Production: log message only, sanitize any data
    if (data) {
      const sanitized = sanitizeData(data);
      console[level](`[${timestamp}] ${message}`, sanitized);
    } else {
      console[level](`[${timestamp}] ${message}`);
    }
  } else {
    // Development: log everything
    if (data) {
      console[level](`[${timestamp}] ${message}`, data);
    } else {
      console[level](`[${timestamp}] ${message}`);
    }
  }
}

/**
 * Convenience methods
 */
export const logger = {
  info: (message: string, data?: any) => secureLog('info', message, data),
  warn: (message: string, data?: any) => secureLog('warn', message, data),
  error: (message: string, data?: any) => secureLog('error', message, data),
  debug: (message: string, data?: any) => secureLog('debug', message, data),
};
