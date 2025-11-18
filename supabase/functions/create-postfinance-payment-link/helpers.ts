/**
 * Get actionable suggestions based on HTTP status code
 */
export function getSuggestionsForStatus(status: number): string[] {
  switch (status) {
    case 401:
      return [
        'Verify POSTFINANCE_USER_ID matches your PostFinance account',
        'Check POSTFINANCE_AUTHENTICATION_KEY is correctly base64-encoded (should be 32 bytes when decoded)',
        'Ensure timestamp is in Unix seconds (10 digits, not 13 digits milliseconds)',
        'Verify MAC signature calculation: POST|/api/transaction/create?spaceId=XXX|TIMESTAMP',
        'Check if the authentication key has been regenerated in PostFinance dashboard',
        'Ensure space ID is correct and the user has access to it'
      ];
    case 403:
      return [
        'Check API credentials have necessary permissions in PostFinance',
        'Verify POSTFINANCE_SPACE_ID is correct',
        'Ensure the space is activated for transaction processing',
        'Check if your PostFinance account has the required subscription/plan',
        'Verify the user ID has admin or API access rights'
      ];
    case 400:
      return [
        'Check transaction payload format matches PostFinance API specification',
        'Verify amount is positive and in cents (e.g., 5000 for €50.00)',
        'Ensure currency code is valid 3-letter ISO code (EUR, CHF, USD, etc.)',
        'Check all required fields are present in the payload',
        'Verify email addresses are properly formatted',
        'Ensure URLs (successUrl, failedUrl) are valid and accessible'
      ];
    case 422:
      return [
        'Validation failed - check all field formats in the payload',
        'Verify email addresses are valid and properly formatted',
        'Check country codes are 2-letter ISO codes (CH, DE, FR, etc.)',
        'Ensure URLs are properly formatted and use HTTPS',
        'Verify names do not contain special characters',
        'Check amount does not exceed maximum transaction limits'
      ];
    case 404:
      return [
        'Verify the API endpoint URL is correct',
        'Check POSTFINANCE_SPACE_ID exists in your PostFinance account',
        'Ensure you are using the correct environment (test vs production)',
        'Verify the space has not been deleted or deactivated'
      ];
    case 429:
      return [
        'Rate limit exceeded - too many requests',
        'Wait a few minutes before retrying',
        'Implement exponential backoff in your retry logic',
        'Contact PostFinance to discuss rate limit increases if needed'
      ];
    case 500:
    case 502:
    case 503:
    case 504:
      return [
        'PostFinance service may be temporarily unavailable',
        'Retry the request after a few seconds with exponential backoff',
        'Check PostFinance status page for service disruptions',
        'If persists, contact PostFinance support with your Request ID'
      ];
    default:
      return [
        `Unexpected status code ${status} - check PostFinance API documentation`,
        'Review the error details and response headers for more information',
        'Check edge function logs for complete request/response data',
        'Contact PostFinance support if the issue persists'
      ];
  }
}

/**
 * Validate transaction payload before sending to PostFinance
 */
export function validateTransactionPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate amount
  if (!payload.lineItems?.[0]?.amountIncludingTax) {
    errors.push('Missing amount in line items');
  } else if (payload.lineItems[0].amountIncludingTax <= 0) {
    errors.push('Amount must be positive');
  } else if (!Number.isInteger(payload.lineItems[0].amountIncludingTax)) {
    errors.push('Amount must be an integer (cents)');
  }

  // Validate currency
  if (!payload.currency) {
    errors.push('Missing currency');
  } else if (!/^[A-Z]{3}$/.test(payload.currency)) {
    errors.push('Currency must be a 3-letter ISO code (e.g., EUR, CHF, USD)');
  }

  // Validate email
  if (!payload.billingAddress?.emailAddress) {
    errors.push('Missing customer email address');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.billingAddress.emailAddress)) {
    errors.push('Invalid email address format');
  }

  // Validate URLs
  if (!payload.successUrl) {
    errors.push('Missing successUrl');
  } else if (!payload.successUrl.startsWith('http')) {
    errors.push('successUrl must be a valid HTTP(S) URL');
  }

  if (!payload.failedUrl) {
    errors.push('Missing failedUrl');
  } else if (!payload.failedUrl.startsWith('http')) {
    errors.push('failedUrl must be a valid HTTP(S) URL');
  }

  // Validate country code
  if (payload.billingAddress?.country && !/^[A-Z]{2}$/.test(payload.billingAddress.country)) {
    errors.push('Country code must be a 2-letter ISO code (e.g., CH, DE, FR)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
