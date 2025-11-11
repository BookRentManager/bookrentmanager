import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderToBuffer, Document } from "https://esm.sh/@react-pdf/renderer@3.1.14";
import React from "https://esm.sh/react@18.2.0";
import { TaxInvoicePDF } from "./TaxInvoicePDF.tsx";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      throw new Error("invoice_id is required");
    }

    // Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from("tax_invoices")
      .select("*, bookings(*)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError) throw invoiceError;

    // Fetch app settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // Render PDF with Document wrapper
    const pdfBuffer = await renderToBuffer(
      React.createElement(
        Document,
        {},
        React.createElement(TaxInvoicePDF, {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          clientName: invoice.client_name,
          clientEmail: invoice.client_email,
          billingAddress: invoice.billing_address,
          lineItems: invoice.line_items,
          subtotal: Number(invoice.subtotal),
          vatRate: Number(invoice.vat_rate),
          vatAmount: Number(invoice.vat_amount),
          totalAmount: Number(invoice.total_amount),
          currency: invoice.currency,
          notes: invoice.notes,
          companyName: settings?.company_name || "KingRent",
          companyEmail: settings?.company_email,
          companyPhone: settings?.company_phone,
          companyAddress: settings?.company_address,
        })
      )
    );

    // Upload to storage
    const fileName = `tax-invoice-${invoice.invoice_number}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("tax-invoice-pdfs")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

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

    if (updateError) throw updateError;

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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
