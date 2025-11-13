// Deno.serve is built-in, no import needed
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderToBuffer, Document } from "https://esm.sh/@react-pdf/renderer@3.1.14";
import React from "https://esm.sh/react@18.2.0";
import { TaxInvoicePDF } from "./TaxInvoicePDF.tsx";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting tax invoice PDF generation...');
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

    console.log('Rendering PDF with data:', {
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name,
      lineItemsCount: invoice.line_items?.length || 0,
      hasSettings: !!settings
    });
    
    // Validate line items
    if (!invoice.line_items || !Array.isArray(invoice.line_items) || invoice.line_items.length === 0) {
      throw new Error('Invoice must have at least one line item');
    }

    // Render PDF with Document wrapper
    const pdfBuffer = await renderToBuffer(
      React.createElement(
        Document,
        {},
        React.createElement(TaxInvoicePDF, {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          clientName: invoice.client_name,
          clientEmail: invoice.client_email || undefined,
          billingAddress: invoice.billing_address || undefined,
          lineItems: invoice.line_items,
          subtotal: Number(invoice.subtotal),
          vatRate: Number(invoice.vat_rate),
          vatAmount: Number(invoice.vat_amount),
          totalAmount: Number(invoice.total_amount),
          currency: invoice.currency,
          notes: invoice.notes || undefined,
          companyName: settings?.company_name || "KingRent",
          companyEmail: settings?.company_email || undefined,
          companyPhone: settings?.company_phone || undefined,
          companyAddress: settings?.company_address || undefined,
          companyLogoUrl: settings?.logo_url || undefined,
          bookingReference: invoice.bookings?.reference_code || undefined,
          rentalDescription: invoice.rental_description || undefined,
          deliveryLocation: invoice.delivery_location || undefined,
          collectionLocation: invoice.collection_location || undefined,
          rentalStartDate: invoice.rental_start_date || undefined,
          rentalEndDate: invoice.rental_end_date || undefined,
        })
      )
    );
    
    console.log('PDF rendered successfully, uploading to storage...');

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
    
    console.log('Tax invoice PDF generation completed successfully');

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
