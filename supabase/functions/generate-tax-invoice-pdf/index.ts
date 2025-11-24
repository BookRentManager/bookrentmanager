import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      throw new Error('invoice_id is required');
    }

    console.log('Generating PDF for invoice:', invoice_id);

    // Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('tax_invoices')
      .select('*, bookings(*)')
      .eq('id', invoice_id)
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error('Invoice not found');

    // Fetch app settings for logo
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    console.log('Invoice data fetched, generating PDF...');

    // Generate PDF using Lovable AI
    const pdfResponse = await fetch('https://api.lovable.app/v1/pdf/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: generateInvoiceHTML(invoice, appSettings),
        options: {
          format: 'A4',
          margin: { top: '16px', right: '16px', bottom: '16px', left: '16px' }
        }
      })
    });

    if (!pdfResponse.ok) {
      throw new Error(`PDF generation failed: ${pdfResponse.statusText}`);
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfBuffer = await pdfBlob.arrayBuffer();

    // Upload PDF to Supabase Storage
    const fileName = `tax-invoice-${invoice.invoice_number}.pdf`;
    const filePath = `tax-invoices/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('tax-invoice-pdfs')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('tax-invoice-pdfs')
      .getPublicUrl(filePath);

    // Update invoice with PDF URL
    const { error: updateError } = await supabaseClient
      .from('tax_invoices')
      .update({ pdf_url: publicUrl })
      .eq('id', invoice_id);

    if (updateError) throw updateError;

    console.log('PDF generated and uploaded successfully');

    return new Response(
      JSON.stringify({ pdf_url: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateInvoiceHTML(invoice: any, appSettings: any): string {
  const formatCurrency = (amount: number) => {
    return `${invoice.currency} ${Number(amount).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB');
  };

  const logoHtml = appSettings?.logo_url 
    ? `<img src="${appSettings.logo_url}" alt="Company Logo" style="width: 100px; height: 50px; object-fit: contain;">`
    : '<h1 style="font-size: 24px; margin: 0;">Tax Invoice</h1>';

  const lineItemsHtml = invoice.line_items.map((item: any, index: number) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 8px; text-align: left;">${item.description}</td>
      <td style="padding: 8px; text-align: right;">${item.quantity}</td>
      <td style="padding: 8px; text-align: right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 8px; text-align: right;">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  const rentalDetailsHtml = invoice.rental_description ? `
    <div style="margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Rental Details</h3>
      <p style="margin: 4px 0;"><strong>Description:</strong> ${invoice.rental_description}</p>
      ${invoice.delivery_location ? `<p style="margin: 4px 0;"><strong>Delivery:</strong> ${invoice.delivery_location}</p>` : ''}
      ${invoice.collection_location ? `<p style="margin: 4px 0;"><strong>Collection:</strong> ${invoice.collection_location}</p>` : ''}
      ${invoice.rental_start_date && invoice.rental_end_date ? `<p style="margin: 4px 0;"><strong>Period:</strong> ${formatDate(invoice.rental_start_date)} - ${formatDate(invoice.rental_end_date)}</p>` : ''}
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
        .container { padding: 20px; }
        .header { border-bottom: 2px solid #2c3e50; padding-bottom: 16px; margin-bottom: 20px; }
        .logo-section { text-align: center; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        .totals { margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-section">${logoHtml}</div>
          <div style="text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">TAX INVOICE</h2>
            <p style="margin: 4px 0;">Invoice #${invoice.invoice_number}</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <div>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(invoice.invoice_date)}</p>
            ${invoice.bookings ? `<p style="margin: 4px 0;"><strong>Booking:</strong> ${invoice.bookings.reference_code}</p>` : ''}
          </div>
          <div style="text-align: right;">
            ${appSettings?.company_name ? `<p style="margin: 4px 0;"><strong>${appSettings.company_name}</strong></p>` : ''}
            ${appSettings?.company_address ? `<p style="margin: 4px 0;">${appSettings.company_address}</p>` : ''}
          </div>
        </div>

        <div style="margin-bottom: 20px; padding: 12px; background: #f9fafb; border-radius: 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px;">Bill To:</h3>
          <p style="margin: 4px 0;"><strong>${invoice.client_name}</strong></p>
          ${invoice.client_email ? `<p style="margin: 4px 0;">${invoice.client_email}</p>` : ''}
          ${invoice.billing_address ? `<p style="margin: 4px 0; white-space: pre-line;">${invoice.billing_address}</p>` : ''}
        </div>

        ${rentalDetailsHtml}

        <table style="margin-top: 20px;">
          <thead style="background: #f3f4f6;">
            <tr>
              <th style="padding: 8px; text-align: left;">Description</th>
              <th style="padding: 8px; text-align: right; width: 80px;">Qty</th>
              <th style="padding: 8px; text-align: right; width: 100px;">Unit Price</th>
              <th style="padding: 8px; text-align: right; width: 100px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <div class="totals" style="margin-top: 20px; text-align: right;">
          <p style="margin: 4px 0;"><strong>Subtotal (Net):</strong> ${formatCurrency(invoice.subtotal)}</p>
          <p style="margin: 4px 0;"><strong>VAT (${invoice.vat_rate}%):</strong> ${formatCurrency(invoice.vat_amount)}</p>
          <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; border-top: 2px solid #2c3e50; padding-top: 8px;">
            <strong>Total (incl. VAT):</strong> ${formatCurrency(invoice.total_amount)}
          </p>
        </div>

        ${invoice.notes ? `
          <div style="margin-top: 30px; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 12px;">Notes:</h4>
            <p style="margin: 0; white-space: pre-line;">${invoice.notes}</p>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}
