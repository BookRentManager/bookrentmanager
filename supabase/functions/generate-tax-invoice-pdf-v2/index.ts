import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting tax invoice PDF generation (v2 with jsPDF)...');
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      throw new Error("invoice_id is required");
    }

    // Fetch invoice data with booking reference
    const { data: invoice, error: invoiceError } = await supabase
      .from("tax_invoices")
      .select("*, bookings(reference_code, car_model)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
      throw invoiceError;
    }
    
    console.log('Invoice data fetched:', invoice.invoice_number);

    // Fetch app settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // Validate line items
    if (!invoice.line_items || !Array.isArray(invoice.line_items) || invoice.line_items.length === 0) {
      throw new Error('Invoice must have at least one line item');
    }

    console.log('Generating PDF with jsPDF...');

    // Create PDF using jsPDF
    const doc = new jsPDF();
    const companyName = settings?.company_name || "KingRent";
    
    // Header
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(companyName, 20, 20);
    
    doc.setFontSize(16);
    doc.text('TAX INVOICE', 20, 30);
    
    // Invoice details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Invoice Number: ${invoice.invoice_number}`, 20, 45);
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 20, 52);
    
    if (invoice.bookings?.reference_code) {
      doc.text(`Booking Reference: ${invoice.bookings.reference_code}`, 20, 59);
    }
    
    // Client information
    doc.setFont(undefined, 'bold');
    doc.text('Bill To:', 20, 72);
    doc.setFont(undefined, 'normal');
    doc.text(invoice.client_name, 20, 79);
    
    if (invoice.client_email) {
      doc.text(invoice.client_email, 20, 86);
    }
    
    if (invoice.billing_address) {
      const addressLines = invoice.billing_address.split('\n');
      let yPos = 93;
      addressLines.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 7;
      });
    }
    
    // Line items table
    let yPos = 120;
    doc.setFont(undefined, 'bold');
    doc.text('Description', 20, yPos);
    doc.text('Qty', 120, yPos);
    doc.text('Unit Price', 140, yPos);
    doc.text('Amount', 170, yPos);
    
    // Draw line under header
    doc.line(20, yPos + 2, 190, yPos + 2);
    
    yPos += 10;
    doc.setFont(undefined, 'normal');
    
    invoice.line_items.forEach((item: any) => {
      doc.text(item.description, 20, yPos);
      doc.text(item.quantity.toString(), 120, yPos);
      doc.text(`${invoice.currency} ${Number(item.unit_price).toFixed(2)}`, 140, yPos);
      doc.text(`${invoice.currency} ${Number(item.amount).toFixed(2)}`, 170, yPos);
      yPos += 7;
    });
    
    // Totals
    yPos += 10;
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    doc.text('Subtotal:', 140, yPos);
    doc.text(`${invoice.currency} ${Number(invoice.subtotal).toFixed(2)}`, 170, yPos);
    yPos += 7;
    
    doc.text(`VAT (${invoice.vat_rate}%):`, 140, yPos);
    doc.text(`${invoice.currency} ${Number(invoice.vat_amount).toFixed(2)}`, 170, yPos);
    yPos += 7;
    
    doc.setFont(undefined, 'bold');
    doc.text('Total:', 140, yPos);
    doc.text(`${invoice.currency} ${Number(invoice.total_amount).toFixed(2)}`, 170, yPos);
    
    // Notes
    if (invoice.notes) {
      yPos += 15;
      doc.setFont(undefined, 'bold');
      doc.text('Notes:', 20, yPos);
      doc.setFont(undefined, 'normal');
      yPos += 7;
      const noteLines = invoice.notes.split('\n');
      noteLines.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 7;
      });
    }
    
    const pdfBuffer = doc.output('arraybuffer');
    
    console.log('PDF generated successfully, uploading to storage...');

    // Upload to storage
    const fileName = `tax-invoice-${invoice.invoice_number}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("tax-invoice-pdfs")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }
    
    console.log('PDF uploaded successfully, generating signed URL...');

    // Get signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from("tax-invoice-pdfs")
      .createSignedUrl(fileName, 31536000);

    if (!urlData?.signedUrl) {
      throw new Error("Failed to generate signed URL");
    }

    // Update invoice with PDF URL
    const { error: updateError } = await supabase
      .from("tax_invoices")
      .update({ pdf_url: urlData.signedUrl })
      .eq("id", invoice_id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }
    
    console.log('Tax invoice PDF generation completed successfully (v2 with jsPDF)');

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: urlData.signedUrl,
        file_path: fileName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating tax invoice PDF:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
