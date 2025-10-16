# PostFinance Webhook Integration Guide

## Overview

This document provides technical specifications for integrating PostFinance payment webhooks with BookRentManager. The webhook integration enables automatic payment status updates, booking confirmations, and invoice management when clients complete payments through PostFinance Checkout.

---

## Webhook Endpoint

### Basic Information

- **Method:** `POST`
- **URL:** `https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/postfinance-webhook`
- **Content-Type:** `application/json`
- **Purpose:** Receive real-time payment status updates from PostFinance Checkout

### Required Headers

PostFinance will send the following headers with each webhook request:

```
Content-Type: application/json
X-PostFinance-Signature: [webhook_signature]
```

---

## Authentication & Security

### Webhook Signature Verification

All webhook requests from PostFinance include a signature in the `X-PostFinance-Signature` header. This signature is generated using your webhook secret and must be verified to ensure the request is legitimate.

**Verification Process:**
1. PostFinance signs the webhook payload using HMAC-SHA256 with your `POSTFINANCE_WEBHOOK_SECRET`
2. The signature is sent in the `X-PostFinance-Signature` header
3. Our system verifies the signature before processing the event
4. Invalid signatures result in `401 Unauthorized` response

**Security Best Practices:**
- Never expose your `POSTFINANCE_WEBHOOK_SECRET` publicly
- Always verify signatures before processing events
- Implement idempotency to handle duplicate webhook deliveries
- Log all webhook events for audit and debugging purposes

---

## Event Types

PostFinance will send webhook events for the following payment lifecycle events:

### 1. payment.succeeded

Sent when a payment is successfully completed.

**Example Payload:**
```json
{
  "type": "payment.succeeded",
  "data": {
    "session_id": "ses_1234567890abcdef",
    "transaction_id": "txn_abcdef1234567890",
    "status": "paid",
    "amount": 75000,
    "currency": "EUR",
    "customer_email": "client@example.com",
    "customer_name": "John Doe",
    "payment_method": "card",
    "metadata": {
      "booking_id": "550e8400-e29b-41d4-a716-446655440000",
      "payment_intent": "down_payment",
      "booking_reference": "KR008906"
    }
  },
  "created_at": "2025-10-16T14:30:00Z"
}
```

**What Happens Automatically:**
- Payment status updated to `paid`
- Transaction ID recorded
- Payment timestamp recorded
- Total amount paid calculated for booking
- Booking auto-confirmed if down payment requirement met
- Client invoice payment status updated
- Confirmation emails sent (when configured)

---

### 2. payment.failed

Sent when a payment attempt fails.

**Example Payload:**
```json
{
  "type": "payment.failed",
  "data": {
    "session_id": "ses_1234567890abcdef",
    "status": "failed",
    "failure_code": "card_declined",
    "failure_message": "Your card was declined",
    "amount": 75000,
    "currency": "EUR",
    "customer_email": "client@example.com",
    "metadata": {
      "booking_id": "550e8400-e29b-41d4-a716-446655440000",
      "payment_intent": "down_payment"
    }
  },
  "created_at": "2025-10-16T14:35:00Z"
}
```

**What Happens Automatically:**
- Payment link status updated to `cancelled`
- Staff notified of failed payment (when configured)
- Booking remains in current status

---

### 3. session.expired

Sent when a checkout session expires without payment completion.

**Example Payload:**
```json
{
  "type": "session.expired",
  "data": {
    "session_id": "ses_1234567890abcdef",
    "status": "expired",
    "amount": 75000,
    "currency": "EUR",
    "metadata": {
      "booking_id": "550e8400-e29b-41d4-a716-446655440000",
      "payment_intent": "down_payment"
    },
    "expired_at": "2025-10-23T14:30:00Z"
  },
  "created_at": "2025-10-23T14:30:05Z"
}
```

**What Happens Automatically:**
- Payment link status updated to `expired`
- Staff can generate a new payment link if needed
- Booking remains in current status

---

## Response Codes

The webhook endpoint returns the following HTTP status codes:

| Code | Meaning | Description |
|------|---------|-------------|
| `200 OK` | Success | Event processed successfully |
| `400 Bad Request` | Validation Error | Missing required fields or invalid payload format |
| `401 Unauthorized` | Authentication Failed | Invalid or missing webhook signature |
| `500 Internal Server Error` | Processing Error | Unexpected error during event processing |

**Success Response Example:**
```json
{
  "received": true
}
```

**Error Response Example:**
```json
{
  "error": "Invalid webhook signature"
}
```

---

## Automatic Updates

When a webhook event is received and processed, the following updates occur automatically:

### Database Updates

**Payments Table:**
- `payment_link_status` → Updated based on event type
- `paid_at` → Set to current timestamp (for successful payments)
- `postfinance_transaction_id` → Transaction ID from PostFinance
- `postfinance_session_id` → Session ID for tracking

**Bookings Table:**
- `amount_paid` → Recalculated as sum of all successful payments
- `status` → Auto-confirmed from 'draft' if down payment requirement met
- `updated_at` → Updated timestamp

**Client Invoices Table:**
- `payment_status` → Updated to 'partial' or 'paid' based on total amount paid
- `updated_at` → Updated timestamp

**Audit Logs:**
- Auto-confirmation events logged with payment details
- Full audit trail maintained for compliance

### Business Logic

**Auto-Confirmation Rules:**
1. Booking must be in 'draft' status
2. Total amount paid must meet or exceed required down payment percentage
3. Down payment percentage is defined in `bookings.payment_amount_percent`
4. If no percentage specified, any payment triggers confirmation

**Example Calculation:**
- Booking Total: €1,500
- Down Payment Required: 50% (€750)
- Payment Received: €750
- Result: Booking auto-confirmed ✓

---

## Webhook Configuration in PostFinance

### Step-by-Step Setup

**Step 1: Access PostFinance Dashboard**
1. Log in to your PostFinance merchant account
2. Navigate to Settings → Webhooks or Developers → Webhooks

**Step 2: Add Webhook Endpoint**
1. Click "Add Endpoint" or "Create Webhook"
2. Enter the webhook URL:
   ```
   https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/postfinance-webhook
   ```

**Step 3: Select Events**
Subscribe to the following events:
- ✓ `payment.succeeded`
- ✓ `payment.failed`
- ✓ `session.expired`

**Step 4: Obtain Webhook Secret**
1. After creating the webhook, PostFinance will provide a webhook signing secret
2. Copy this secret (it looks like: `whsec_...`)
3. This secret must be configured in your BookRentManager system
4. Store it securely - it's used to verify webhook authenticity

**Step 5: Test the Integration**
1. Use PostFinance test mode to generate test events
2. Verify events are received and processed correctly
3. Check payment and booking status updates in BookRentManager

**Step 6: Enable in Production**
1. Once testing is complete, enable the webhook in production mode
2. Update your webhook secret if different from test mode
3. Monitor the first few real transactions carefully

---

## Testing the Integration

### Test Mode

PostFinance provides a test mode for safe testing without real money:

**Test Card Numbers:**
- **Successful Payment:** `4242 4242 4242 4242`
- **Declined Payment:** `4000 0000 0000 0002`
- **Insufficient Funds:** `4000 0000 0000 9995`
- **Expired Card:** `4000 0000 0000 0069`

**Test Details:**
- Any future expiration date
- Any 3-digit CVC
- Any name

### Testing Workflow

**1. Generate Test Payment Link:**
```
1. Create or select a booking in BookRentManager
2. Go to booking details → Payments tab
3. Click "Generate Payment Link"
4. Fill in amount and select "Test Mode"
5. Copy the generated payment link
```

**2. Complete Test Payment:**
```
1. Open payment link in browser
2. Enter test card details
3. Complete checkout process
4. PostFinance sends webhook to our system
```

**3. Verify Updates:**
```
1. Check payment status updated to 'paid'
2. Verify booking amount_paid increased
3. Confirm booking status changed (if down payment met)
4. Check client invoice payment status updated
```

### Webhook Event Logs

To verify webhook events are being received:

**In PostFinance Dashboard:**
- Navigate to Webhooks → [Your Webhook] → Events
- View delivery status and response codes
- Retry failed deliveries if needed

**In BookRentManager:**
- Backend logs show all webhook events received
- Check for successful processing or error messages
- Review audit logs for auto-confirmation events

---

## Troubleshooting

### Common Issues

**1. Webhook Events Not Received**

**Symptoms:**
- Payment completed but status not updated
- No automatic booking confirmation

**Solutions:**
- ✓ Verify webhook URL is correct in PostFinance dashboard
- ✓ Check webhook is enabled and active
- ✓ Ensure selected events include required types
- ✓ Check PostFinance webhook delivery logs for errors
- ✓ Verify firewall/network allows PostFinance IP ranges

---

**2. Signature Verification Failures**

**Symptoms:**
- Webhook events return `401 Unauthorized`
- Logs show signature verification errors

**Solutions:**
- ✓ Verify `POSTFINANCE_WEBHOOK_SECRET` is configured correctly
- ✓ Ensure no extra whitespace in secret value
- ✓ Check secret matches the one in PostFinance dashboard
- ✓ Regenerate webhook secret if needed

---

**3. Payment Status Not Updating**

**Symptoms:**
- Webhook received but payment/booking status unchanged

**Solutions:**
- ✓ Check `session_id` in webhook matches payment record
- ✓ Verify payment exists in database with matching `postfinance_session_id`
- ✓ Review backend error logs for processing errors
- ✓ Ensure payment table has required columns

---

**4. Booking Not Auto-Confirming**

**Symptoms:**
- Payment successful but booking stays in 'draft'

**Solutions:**
- ✓ Verify down payment amount meets requirement
- ✓ Check `bookings.payment_amount_percent` is set correctly
- ✓ Ensure booking is in 'draft' status (not already confirmed)
- ✓ Review audit logs for auto-confirmation logic execution

---

### Retry Mechanism

**PostFinance Webhook Retries:**
- PostFinance automatically retries failed webhook deliveries
- Exponential backoff: 5s, 30s, 2m, 10m, 30m, 1h, 3h
- Up to 3 days of retry attempts
- Manual retry available in PostFinance dashboard

**Recommended Timeout:**
- Webhook endpoint timeout: 30 seconds
- PostFinance expects response within this timeframe

---

## Integration Flow Diagram

```
┌─────────────┐
│   Staff     │
│  Generates  │
│ Payment Link│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ BookRentManager creates payment     │
│ record with PostFinance session_id  │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────┐
│ Email sent to client     │
│ with payment link        │
└──────────┬───────────────┘
           │
           ▼
┌────────────────────────────┐
│ Client clicks link &       │
│ completes payment on       │
│ PostFinance Checkout       │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│ PostFinance sends webhook event    │
│ to our system                      │
│ Event: payment.succeeded           │
└──────────┬─────────────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│ Webhook Handler:                   │
│ 1. Verifies signature              │
│ 2. Finds payment by session_id     │
│ 3. Updates payment status to 'paid'│
│ 4. Records transaction_id & time   │
└──────────┬─────────────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│ Database Trigger:                  │
│ 1. Calculates total paid amount    │
│ 2. Updates booking.amount_paid     │
│ 3. Checks down payment requirement │
│ 4. Auto-confirms booking if met    │
│ 5. Updates invoice payment status  │
└──────────┬─────────────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│ Confirmation:                      │
│ - Client receives confirmation     │
│ - Staff sees updated booking       │
│ - Audit log created                │
└────────────────────────────────────┘
```

---

## Technical Reference

### Webhook Payload Fields

**Common Fields (All Events):**
- `type` (string, required): Event type identifier
- `data` (object, required): Event-specific data
- `created_at` (string, ISO 8601): Event creation timestamp

**Data Object Fields:**
- `session_id` (string, required): Unique checkout session identifier
- `transaction_id` (string): Transaction ID (successful payments only)
- `status` (string, required): Payment status
- `amount` (integer): Amount in smallest currency unit (cents)
- `currency` (string): ISO 4217 currency code
- `customer_email` (string): Customer's email address
- `customer_name` (string): Customer's name
- `payment_method` (string): Payment method used
- `metadata` (object): Custom metadata passed during session creation
  - `booking_id` (uuid): Associated booking ID
  - `payment_intent` (string): Purpose of payment
  - `booking_reference` (string): Human-readable booking reference

### Signature Verification Algorithm

PostFinance uses HMAC-SHA256 for signature generation:

```javascript
// Pseudo-code for signature verification
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Database Schema Reference

**Payments Table Columns:**
- `id` (uuid): Primary key
- `booking_id` (uuid): Foreign key to bookings
- `amount` (numeric): Payment amount
- `currency` (text): Currency code
- `type` (enum): Payment type
- `method` (enum): Payment method
- `payment_link_id` (text): PostFinance session ID
- `payment_link_url` (text): Checkout URL
- `payment_link_status` (enum): Status ('pending', 'active', 'expired', 'paid', 'cancelled')
- `payment_link_expires_at` (timestamptz): Link expiration time
- `postfinance_session_id` (text): PostFinance session identifier
- `postfinance_transaction_id` (text): Transaction ID after successful payment
- `payment_intent` (text): Purpose ('client_payment', 'down_payment', 'final_payment')
- `paid_at` (timestamptz): Payment completion timestamp
- `created_at` (timestamptz): Record creation time
- `updated_at` (timestamptz): Last update time

---

## Support & Resources

### Questions?

If you need assistance with the PostFinance webhook integration:

1. **Check PostFinance Documentation:**
   - PostFinance API documentation
   - Webhook configuration guides
   - Test mode instructions

2. **Review System Logs:**
   - Backend webhook event logs
   - PostFinance webhook delivery logs
   - Database audit logs

3. **Contact Support:**
   - PostFinance merchant support for API/webhook issues
   - BookRentManager technical support for integration issues

### Additional Resources

- PostFinance API Reference
- PostFinance Webhook Guide
- BookRentManager Payment Processing Guide
- PCI DSS Compliance Guidelines

---

## Changelog

### Version 1.0 (October 2025)
- Initial webhook integration
- Support for payment.succeeded, payment.failed, session.expired events
- Automatic booking confirmation on down payment
- Client invoice status updates
- Signature verification for security
- Comprehensive error handling and logging

---

**Last Updated:** October 16, 2025  
**Integration Version:** 1.0  
**API Version:** PostFinance Checkout API v1