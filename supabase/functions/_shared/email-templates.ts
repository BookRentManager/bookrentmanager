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
  currency?: string;
  delivery_datetime?: string;
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
    box-shadow: 0 4px 20px rgba(197, 165, 114, 0.2);
  }
  .header {
    background: linear-gradient(180deg, #000000 0%, #1a1a1a 100%);
    color: #C5A572;
    padding: 40px 20px;
    text-align: center;
    border-bottom: 3px solid;
    border-image: linear-gradient(90deg, transparent, #C5A572, transparent) 1;
  }
  .header h1 {
    margin: 10px 0 5px 0;
    font-size: 28px;
    font-weight: 700;
    font-family: 'Playfair Display', Georgia, serif;
    letter-spacing: 0.5px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .header-tagline {
    font-size: 12px;
    opacity: 0.9;
    font-style: italic;
    margin-top: 5px;
    color: #C5A572;
  }
  .logo-img {
    max-width: 200px;
    height: auto;
    display: block;
    margin: 0 auto 15px auto;
    object-fit: contain;
  }
  .content {
    padding: 30px 20px;
  }
  .booking-details {
    background: #fafafa;
    border-left: 4px solid #C5A572;
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
    padding: 14px 24px;
    background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
    color: #C5A572;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 700;
    font-size: 16px;
    margin: 20px auto;
    text-align: center;
    border: 2px solid #C5A572;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(197, 165, 114, 0.3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    max-width: 280px;
  }
  .button:hover {
    background: linear-gradient(135deg, #C5A572 0%, #d4b582 100%);
    color: #000000;
    box-shadow: 0 6px 20px rgba(197, 165, 114, 0.5);
    transform: translateY(-2px);
  }
  @media only screen and (max-width: 480px) {
    .header, .content, .footer {
      padding-left: 12px;
      padding-right: 12px;
    }
  }
  .gold-divider {
    height: 2px;
    background: linear-gradient(90deg, transparent, #C5A572, transparent);
    margin: 25px 0;
  }
  .footer {
    background: linear-gradient(180deg, #1a1a1a 0%, #000000 100%);
    padding: 30px 20px;
    text-align: center;
    color: #C5A572;
    font-size: 14px;
    border-top: 2px solid #C5A572;
  }
  .footer-tagline {
    font-size: 13px;
    font-style: italic;
    margin-bottom: 10px;
    color: #C5A572;
  }
  .footer-trust {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid rgba(197, 165, 114, 0.3);
    font-size: 11px;
    opacity: 0.8;
  }
  .amount-highlight {
    font-size: 20px;
    font-weight: 700;
    color: #C5A572;
  }
  .bank-details {
    background: #fffbf0;
    border: 2px solid #C5A572;
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
  formUrl: string,
  appSettings?: any
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/king-rent-logo.png" alt="King Rent Logo" class="logo-img" />
      <h1>Booking Confirmation</h1>
      <p class="header-tagline">Experience Luxury on Wheels</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p style="font-size: 16px; line-height: 1.7;">✨ <strong>Welcome to the King Rent family!</strong></p>
      <p>Thank you for choosing us for your luxury car rental. We've received your reservation request and are thrilled to serve you with our premium service.</p>
      <div class="gold-divider"></div>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #C5A572; font-family: 'Playfair Display', serif;">Booking Summary</h3>
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

      <div class="gold-divider"></div>
      <p><strong>📋 What to Expect Next:</strong></p>
      <ol style="line-height: 2; font-size: 15px;">
        <li><strong>Step 1:</strong> Review and sign the rental agreement</li>
        <li><strong>Step 2:</strong> Accept our terms and conditions</li>
        <li><strong>Step 3:</strong> Complete your payment securely</li>
      </ol>
      <p style="background: #fffbf0; padding: 12px; border-left: 4px solid #C5A572; margin: 20px 0; font-size: 14px;">
        💡 <strong>Takes only 5 minutes!</strong> Your luxury vehicle is reserved and waiting for you.
      </p>

      <div style="text-align: center;">
        <a href="${formUrl}" class="button">Complete Your Booking ✨</a>
      </div>

      <p style="color: #6c757d; font-size: 14px; margin-top: 30px; text-align: center;">
        <strong>Your dedicated team is here to assist you.</strong><br/>
        This secure link will expire in 30 days. Complete your booking now to ensure your reservation.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-tagline">Premium Car Rental Excellence</p>
      <p>If you have any questions, our concierge team is ready to help.</p>
      <div class="footer-trust">
        🔒 Secure Payment | ⭐ Verified Service | 🚗 Premium Fleet
      </div>
      <p style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
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
  payment: PaymentDetails,
  appSettings?: any
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/king-rent-logo.png" alt="King Rent Logo" class="logo-img" />
      <h1>Payment Received</h1>
      <p class="header-tagline">Thank You for Trusting King Rent</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p style="font-size: 16px; line-height: 1.7;">🎉 <strong>Payment Confirmed!</strong></p>
      <p>We've successfully received your payment. Your booking is now one step closer to being complete!</p>
      <div class="gold-divider"></div>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #C5A572; font-family: 'Playfair Display', serif;">Payment Details</h3>
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
        <h3 style="margin-top: 0; color: #C5A572; font-family: 'Playfair Display', serif;">Your Booking</h3>
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

      <div class="gold-divider"></div>
      ${payment.remaining_balance && payment.remaining_balance > 0 ? `
      <p style="background: #fff3cd; padding: 15px; border-left: 4px solid #C5A572; margin: 20px 0; border-radius: 4px;">
        <strong>💡 What's Next?</strong><br/>
        Please complete the remaining balance payment (€${payment.remaining_balance.toFixed(2)}) before your pick-up date. We're here to help make this process smooth and easy for you!
      </p>
      ` : `
      <p style="background: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 4px;">
        <strong>✨ You're All Set!</strong><br/>
        Your booking is confirmed and fully paid. Your luxury vehicle awaits! We're excited to provide you with an exceptional rental experience.
      </p>
      `}

      <p style="margin-top: 30px; font-size: 14px;">
        <strong>📄 Receipt Attached:</strong> A detailed payment receipt is included with this email for your records and peace of mind.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-tagline">Your Satisfaction is Our Priority</p>
      <p>Thank you for choosing King Rent for your luxury car rental needs!</p>
      <div class="footer-trust">
        🔒 Secure Transaction | ⭐ Premium Service | 🚗 Quality Guaranteed
      </div>
      <p style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
        Keep this email as proof of payment. For any questions, our team is always ready to assist.
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
  paymentUrl: string,
  daysUntilDelivery?: number,
  appSettings?: any
): string {
  const companyName = appSettings?.company_name || 'KingRent';
  const logoUrl = appSettings?.logo_url || '/king-rent-logo.png';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="${companyName} Logo" class="logo-img" />
      <h1>Balance Payment Reminder</h1>
      <p class="header-tagline">Complete Your Payment</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p style="font-size: 16px; line-height: 1.7;">This is a friendly reminder about the outstanding balance for your upcoming rental.</p>
      <div class="gold-divider"></div>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #C5A572; font-family: 'Playfair Display', serif;">Outstanding Balance</h3>
        <div class="detail-row">
          <span class="detail-label">Remaining Amount:</span>
          <span class="detail-value amount-highlight">${booking.currency || 'EUR'} ${remainingAmount.toFixed(2)}</span>
        </div>
        ${daysUntilDelivery !== undefined ? `
        <div class="detail-row">
          <span class="detail-label">Days Until Pickup:</span>
          <span class="detail-value">${daysUntilDelivery} ${daysUntilDelivery === 1 ? 'day' : 'days'}</span>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentUrl}" class="button">Access the Client Portal</a>
      </div>

      <p style="color: #6c757d; font-size: 14px; margin-top: 30px; text-align: center;">
        If you've already completed this payment, please disregard this reminder.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-tagline">Premium Car Rental Excellence</p>
      <p>Questions? Our team is here to help!</p>
      <div class="footer-trust">
        🔒 Secure Payment | ⭐ Verified Service | 🚗 Premium Fleet
      </div>
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
  },
  appSettings?: any
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/king-rent-logo.png" alt="King Rent Logo" class="logo-img" />
      <h1>Bank Transfer Instructions</h1>
      <p class="header-tagline">Secure & Simple Payment Process</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p style="font-size: 16px; line-height: 1.7;">🏦 <strong>Bank Transfer Payment</strong></p>
      <p>Thank you for choosing bank transfer. Here are your secure payment details with a simple step-by-step guide:</p>
      <div class="gold-divider"></div>
      
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
        <h3 style="margin-top: 0; color: #C5A572; font-family: 'Playfair Display', serif;">Your Booking</h3>
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

      <div class="gold-divider"></div>
      <p style="background: #e7f3ff; padding: 20px; border-left: 4px solid #C5A572; margin: 20px 0; border-radius: 4px;">
        <strong>📋 Step-by-Step Guide:</strong><br/>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Log into your online banking</li>
          <li>Create a new transfer with the details above</li>
          <li><strong style="color: #C5A572;">CRITICAL:</strong> Include the reference number in the payment description</li>
          <li>Submit the transfer</li>
        </ol>
        <strong>⏱️ Processing Time:</strong> 1-3 business days<br/>
        <strong>✅ Confirmation:</strong> You'll receive an email once we process your payment
      </p>

      <p style="text-align: center; margin-top: 30px; font-size: 15px;">
        <strong>🔒 Your payment security is our priority.</strong><br/>
        We'll confirm your booking as soon as your transfer is received.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-tagline">Transparent & Secure Banking</p>
      <p>Questions about the payment process? We're here to guide you every step of the way.</p>
      <div class="footer-trust">
        🔒 Secure Banking | ⏱️ Quick Processing | 📧 Instant Confirmation
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

export function getBookingConfirmedEmail(
  booking: BookingDetails,
  portalUrl: string,
  appSettings?: any
): string {
  const remainingBalance = booking.amount_total - (booking.amount_paid || 0);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://bookrentmanager.lovable.app/king-rent-logo.png" alt="King Rent Logo" class="logo-img" />
      <h1>🎉 You're All Set!</h1>
      <p class="header-tagline">Your Luxury Vehicle Awaits</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p style="font-size: 17px; line-height: 1.7;">✨ <strong>Booking Confirmed - Your Dream Vehicle is Reserved!</strong></p>
      <p>Congratulations! Your booking is complete and confirmed. We're thrilled to provide you with an exceptional luxury car rental experience.</p>
      <div class="gold-divider"></div>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #C5A572; font-family: 'Playfair Display', serif;">Booking Summary</h3>
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

      <div class="gold-divider"></div>
      
      <div style="background: #e7f3ff; border-left: 4px solid #C5A572; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <strong style="font-size: 16px; color: #C5A572;">📱 Your Personal Booking Portal</strong>
        <p style="margin: 15px 0 10px 0; font-size: 15px;">Everything you need, in one secure place:</p>
        <ul style="margin: 5px 0; padding-left: 20px; line-height: 2;">
          <li>📄 Download your booking confirmation PDF</li>
          <li>👀 View complete booking details anytime</li>
          <li>📤 Upload required documents</li>
          <li>💳 Track payment status in real-time</li>
          <li>💰 Complete outstanding payments securely</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button">
          Access Your Booking Portal ✨
        </a>
      </div>

      ${remainingBalance > 0 ? `
      <p style="background: #fff3cd; padding: 15px; border-left: 4px solid #C5A572; margin: 20px 0; border-radius: 4px;">
        <strong>💡 Reminder:</strong> You have a remaining balance of €${remainingBalance.toFixed(2)} to pay before pickup. Use your portal to complete this payment at your convenience.
      </p>
      ` : `
      <p style="background: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 4px;">
        <strong>✨ Perfect!</strong> Your booking is fully paid. All that's left is to enjoy your luxury rental experience!
      </p>
      `}

      <p style="font-size: 15px; text-align: center; margin-top: 30px;">
        <strong>📌 Pre-Arrival Checklist:</strong>
      </p>
      <ul style="margin: 10px auto; padding-left: 0; max-width: 400px; list-style: none; text-align: left;">
        <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">✅ Booking confirmed</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${remainingBalance > 0 ? '⏳' : '✅'} Payment ${remainingBalance > 0 ? 'pending' : 'complete'}</li>
        <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">📄 Upload documents via portal</li>
        <li style="padding: 8px 0;">🚗 Pick up your luxury vehicle</li>
      </ul>

      <p style="color: #6c757d; font-size: 14px; margin-top: 30px; text-align: center;">
        <strong>💾 Bookmark your portal:</strong> Save the link for instant access anytime, anywhere.
      </p>

    </div>
    
    <div class="footer">
      <p class="footer-tagline">Experience the Difference of Premium Service</p>
      <p>We're excited to serve you! Your luxury vehicle is ready and waiting.</p>
      <div class="footer-trust">
        🔒 Secure Booking | ⭐ 5-Star Service | 🚗 Premium Fleet | 🤝 Dedicated Support
      </div>
      <p style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
        Questions? Our concierge team is available 24/7 to assist you.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getSecurityDepositReminderEmail(
  booking: BookingDetails,
  depositAmount: number,
  portalUrl: string,
  daysUntilDelivery: number,
  appSettings?: any
): string {
  const companyName = appSettings?.company_name || 'KingRent';
  const logoUrl = appSettings?.logo_url || '/king-rent-logo.png';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="${companyName} Logo" class="logo-img" />
      <h1>Security Deposit Authorization</h1>
      <p class="header-tagline">Action Required</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Ref: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Dear ${booking.client_name},</h2>
      <p style="font-size: 16px; line-height: 1.7;">Please authorize the security deposit for your upcoming rental. This is a pre-authorization only, not a charge.</p>
      <div class="gold-divider"></div>
      
      <div class="booking-details">
        <h3 style="margin-top: 0; color: #C5A572; font-family: 'Playfair Display', serif;">Security Deposit Required</h3>
        <div class="detail-row">
          <span class="detail-label">Deposit Amount:</span>
          <span class="detail-value amount-highlight">${booking.currency || 'EUR'} ${depositAmount.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Days Until Pickup:</span>
          <span class="detail-value">${daysUntilDelivery} ${daysUntilDelivery === 1 ? 'day' : 'days'}</span>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button">Access the Client Portal</a>
      </div>

      <p style="color: #6c757d; font-size: 14px; margin-top: 30px; text-align: center;">
        The deposit will be automatically released after your rental is complete.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-tagline">Premium Car Rental Excellence</p>
      <p>Questions? Our team is here to help!</p>
      <div class="footer-trust">
        🔒 Secure Process | ⭐ Verified Service | 🚗 Premium Fleet
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

export function getEmailSubject(
  type: 'booking_confirmation' | 'payment_confirmation' | 'balance_reminder' | 'bank_transfer' | 'booking_confirmed' | 'security_deposit_reminder', 
  referenceCode: string
): string {
  const subjects = {
    booking_confirmation: `Booking Confirmation - ${referenceCode}`,
    payment_confirmation: `Payment Received - ${referenceCode}`,
    balance_reminder: `Balance Payment Reminder - ${referenceCode}`,
    bank_transfer: `Bank Transfer Instructions - ${referenceCode}`,
    booking_confirmed: `Booking Confirmed - ${referenceCode}`,
    security_deposit_reminder: `Security Deposit Authorization Required - ${referenceCode}`
  };
  return subjects[type];
}
