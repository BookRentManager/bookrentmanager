// Email template library for Gmail sending
// Provides HTML email templates with consistent branding

interface BookingDetails {
  reference_code: string;
  client_name: string;
  car_model: string;
  pickup_date: string;
  return_date: string;
  pickup_location: string;
  return_location: string;
  amount_total: number;
  amount_paid?: number;
}

interface PaymentDetails {
  amount: number;
  payment_method: string;
  transaction_id: string;
  payment_date: string;
  remaining_balance?: number;
}

const BASE_STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f4f4f4;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 20px auto;
    background: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px 20px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  .content {
    padding: 30px 20px;
  }
  .booking-details {
    background: #f8f9fa;
    border-left: 4px solid #667eea;
    padding: 15px;
    margin: 20px 0;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #e9ecef;
  }
  .detail-row:last-child {
    border-bottom: none;
  }
  .detail-label {
    font-weight: 600;
    color: #495057;
  }
  .detail-value {
    color: #212529;
  }
  .button {
    display: inline-block;
    padding: 14px 28px;
    background: #667eea;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    margin: 20px 0;
    text-align: center;
  }
  .button:hover {
    background: #5568d3;
  }
  .footer {
    background: #f8f9fa;
    padding: 20px;
    text-align: center;
    color: #6c757d;
    font-size: 14px;
  }
  .amount-highlight {
    font-size: 20px;
    font-weight: 700;
    color: #667eea;
  }
  .bank-details {
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: 6px;
    padding: 15px;
    margin: 20px 0;
  }
  .bank-details strong {
    display: block;
    margin-bottom: 10px;
    color: #856404;
  }
  .bank-info {
    font-family: 'Courier New', monospace;
    background: white;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
  }
`;

export function getBookingConfirmationEmail(
  booking: BookingDetails,
  formUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚗 Booking Confirmation</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.95;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p>Thank you for your booking! We've received your reservation request and are excited to serve you.</p>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #667eea;">Booking Summary</h3>
        <div class="detail-row">
          <span class="detail-label">Vehicle:</span>
          <span class="detail-value">${booking.car_model}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pick-up:</span>
          <span class="detail-value">${booking.pickup_date} - ${booking.pickup_location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Return:</span>
          <span class="detail-value">${booking.return_date} - ${booking.return_location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Amount:</span>
          <span class="detail-value amount-highlight">€${booking.amount_total.toFixed(2)}</span>
        </div>
      </div>

      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Review and sign the rental agreement</li>
        <li>Accept our terms and conditions</li>
        <li>Complete your payment</li>
      </ol>

      <div style="text-align: center;">
        <a href="${formUrl}" class="button">Complete Your Booking →</a>
      </div>

      <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
        This link will expire in 30 days. Please complete your booking as soon as possible to secure your reservation.
      </p>
    </div>
    
    <div class="footer">
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p style="margin-top: 10px; font-size: 12px;">
        This is an automated email. Please do not reply directly to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getPaymentConfirmationEmail(
  booking: BookingDetails,
  payment: PaymentDetails
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Received</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.95;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p>We've successfully received your payment. Thank you!</p>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #28a745;">Payment Details</h3>
        <div class="detail-row">
          <span class="detail-label">Amount Paid:</span>
          <span class="detail-value amount-highlight">€${payment.amount.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Method:</span>
          <span class="detail-value">${payment.payment_method}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Transaction ID:</span>
          <span class="detail-value">${payment.transaction_id}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Date:</span>
          <span class="detail-value">${payment.payment_date}</span>
        </div>
        ${payment.remaining_balance && payment.remaining_balance > 0 ? `
        <div class="detail-row">
          <span class="detail-label">Remaining Balance:</span>
          <span class="detail-value" style="color: #dc3545; font-weight: 600;">€${payment.remaining_balance.toFixed(2)}</span>
        </div>
        ` : `
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value" style="color: #28a745; font-weight: 600;">✓ Fully Paid</span>
        </div>
        `}
      </div>

      <div class="booking-details">
        <h3 style="margin-top: 0; color: #667eea;">Your Booking</h3>
        <div class="detail-row">
          <span class="detail-label">Vehicle:</span>
          <span class="detail-value">${booking.car_model}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pick-up:</span>
          <span class="detail-value">${booking.pickup_date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Return:</span>
          <span class="detail-value">${booking.return_date}</span>
        </div>
      </div>

      ${payment.remaining_balance && payment.remaining_balance > 0 ? `
      <p style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <strong>⚠️ Reminder:</strong> Please complete the remaining balance payment before your pick-up date.
      </p>
      ` : `
      <p style="background: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
        <strong>🎉 All set!</strong> Your booking is confirmed and fully paid. We look forward to serving you!
      </p>
      `}

      <p style="margin-top: 30px;">A detailed payment receipt is attached to this email for your records.</p>
    </div>
    
    <div class="footer">
      <p>Thank you for choosing our service!</p>
      <p style="margin-top: 10px; font-size: 12px;">
        Keep this email as proof of payment.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getBalancePaymentReminderEmail(
  booking: BookingDetails,
  remainingAmount: number,
  paymentUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Balance Payment Required</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.95;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p>This is a friendly reminder that you have an outstanding balance for your upcoming booking.</p>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #667eea;">Booking Details</h3>
        <div class="detail-row">
          <span class="detail-label">Vehicle:</span>
          <span class="detail-value">${booking.car_model}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pick-up Date:</span>
          <span class="detail-value">${booking.pickup_date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Amount:</span>
          <span class="detail-value">€${booking.amount_total.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Already Paid:</span>
          <span class="detail-value">€${(booking.amount_paid || 0).toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Remaining Balance:</span>
          <span class="detail-value amount-highlight">€${remainingAmount.toFixed(2)}</span>
        </div>
      </div>

      <p><strong>Please complete your payment before the pick-up date to ensure a smooth rental experience.</strong></p>

      <div style="text-align: center;">
        <a href="${paymentUrl}" class="button">Pay Balance Now →</a>
      </div>

      <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
        If you've already made this payment, please disregard this reminder.
      </p>
    </div>
    
    <div class="footer">
      <p>Questions? We're here to help!</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getBankTransferInstructionsEmail(
  booking: BookingDetails,
  amount: number,
  bankDetails: {
    accountName: string;
    iban: string;
    bic: string;
    bankName: string;
    reference: string;
  }
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏦 Bank Transfer Instructions</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.95;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p>Thank you for choosing bank transfer as your payment method. Please use the following details to complete your payment:</p>
      
      <div class="bank-details">
        <strong>⚠️ IMPORTANT: Please include the reference code in your transfer</strong>
        <div class="bank-info">
          <div style="margin-bottom: 8px;">
            <strong>Account Name:</strong> ${bankDetails.accountName}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>IBAN:</strong> ${bankDetails.iban}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>BIC/SWIFT:</strong> ${bankDetails.bic}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Bank:</strong> ${bankDetails.bankName}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Amount:</strong> <span style="font-size: 18px; color: #667eea;">€${amount.toFixed(2)}</span>
          </div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 2px solid #ffc107;">
            <strong>Payment Reference:</strong> <span style="font-size: 16px; color: #dc3545;">${bankDetails.reference}</span>
          </div>
        </div>
      </div>

      <div class="booking-details">
        <h3 style="margin-top: 0; color: #667eea;">Your Booking</h3>
        <div class="detail-row">
          <span class="detail-label">Vehicle:</span>
          <span class="detail-value">${booking.car_model}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pick-up:</span>
          <span class="detail-value">${booking.pickup_date} - ${booking.pickup_location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Return:</span>
          <span class="detail-value">${booking.return_date} - ${booking.return_location}</span>
        </div>
      </div>

      <p style="background: #d1ecf1; padding: 15px; border-left: 4px solid #17a2b8; margin: 20px 0;">
        <strong>ℹ️ Note:</strong> Bank transfers may take 1-3 business days to process. Your booking will be confirmed once we receive the payment.
      </p>

      <p>We'll send you a confirmation email once your payment is received and processed.</p>
    </div>
    
    <div class="footer">
      <p>If you have any questions about the payment process, please contact us.</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getBookingConfirmedEmail(
  booking: BookingDetails,
  portalUrl: string
): string {
  const remainingBalance = booking.amount_total - (booking.amount_paid || 0);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Booking Confirmed!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.95;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p>Great news! Your booking has been confirmed. We're looking forward to serving you!</p>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #667eea;">Booking Summary</h3>
        <div class="detail-row">
          <span class="detail-label">Vehicle:</span>
          <span class="detail-value">${booking.car_model}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pick-up:</span>
          <span class="detail-value">${booking.pickup_date} - ${booking.pickup_location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Return:</span>
          <span class="detail-value">${booking.return_date} - ${booking.return_location}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Amount:</span>
          <span class="detail-value amount-highlight">€${booking.amount_total.toFixed(2)}</span>
        </div>
        ${booking.amount_paid && booking.amount_paid > 0 ? `
        <div class="detail-row">
          <span class="detail-label">Amount Paid:</span>
          <span class="detail-value">€${booking.amount_paid.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Remaining Balance:</span>
          <span class="detail-value" style="color: ${remainingBalance > 0 ? '#dc3545' : '#28a745'}; font-weight: 600;">€${remainingBalance.toFixed(2)}</span>
        </div>
        ` : ''}
      </div>

      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong>📱 Your Booking Portal</strong>
        <p style="margin: 10px 0;">Access your personal booking portal anytime to:</p>
        <ul style="margin: 5px 0; padding-left: 20px;">
          <li>Download your booking PDF</li>
          <li>View all booking details</li>
          <li>Upload required documents</li>
          <li>Track payment status</li>
          <li>Make outstanding payments</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button" style="font-size: 16px; padding: 14px 28px;">
          🔗 Access Your Booking Portal
        </a>
      </div>

      <p style="color: #6c757d; font-size: 14px; margin-top: 20px; text-align: center;">
        💡 In your portal, you can download your booking PDF, upload documents, and manage payments.
      </p>

      <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
        💡 <strong>Tip:</strong> Save the portal link for easy access. You can return to it anytime to manage your booking.
      </p>

      ${remainingBalance > 0 ? `
      <p style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px;">
        <strong>⚠️ Before Pick-up:</strong><br>
        • Complete outstanding payment of €${remainingBalance.toFixed(2)}<br>
        • Upload required documents (if applicable)<br>
        • Authorize security deposit (if required)
      </p>
      ` : `
      <p style="background: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 4px;">
        <strong>✓ Fully Paid!</strong> Please remember to:<br>
        • Upload required documents (if applicable)<br>
        • Authorize security deposit (if required)
      </p>
      `}
    </div>
    
    <div class="footer">
      <p>Thank you for choosing us!</p>
      <p style="margin-top: 10px; font-size: 12px;">
        Questions? Contact us anytime.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getEmailSubject(type: 'booking_confirmation' | 'payment_confirmation' | 'balance_reminder' | 'bank_transfer' | 'booking_confirmed', referenceCode: string): string {
  const subjects = {
    booking_confirmation: `Booking Confirmation - ${referenceCode}`,
    payment_confirmation: `Payment Received - ${referenceCode}`,
    balance_reminder: `Balance Payment Reminder - ${referenceCode}`,
    bank_transfer: `Bank Transfer Instructions - ${referenceCode}`,
    booking_confirmed: `Booking Confirmed - ${referenceCode}`,
  };
  return subjects[type];
}
