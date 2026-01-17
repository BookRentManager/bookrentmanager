import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    console.log('Analyzing invoice:', file.name, file.type, file.size);

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    // PDFs larger than 4MB might fail with vision API
    if (isPDF && file.size > 4 * 1024 * 1024) {
      console.log('PDF too large for AI analysis, requiring manual input');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PDF file is too large for automatic analysis. Please enter the details manually.',
          needsManualInput: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert file to base64 in chunks to avoid stack overflow
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64 = btoa(binary);
    const mimeType = file.type || (isPDF ? 'application/pdf' : 'image/jpeg');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Call Lovable AI to extract invoice details
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling Lovable AI for invoice analysis...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are analyzing an invoice document. Extract the following information:

1. **SUPPLIER NAME**: The company/business that issued this invoice. Look for:
   - Company name in the header or letterhead
   - "From:" or "Issued by:" fields
   - The business name at the top of the invoice
   - Company logo with text name
   - Common patterns: "XYZ GmbH", "ABC AG", "Company Ltd", "S.r.l.", etc.

2. **INVOICE REFERENCE**: The invoice number or document reference. Look for:
   - "Invoice #", "Invoice No.", "Rechnung Nr.", "Fattura N.", "Facture N°"
   - "Document ID", "Reference", "Ref."
   - Usually a combination of numbers/letters like "INV-2024-001", "R-10122", "254/2024"

3. **TOTAL AMOUNT**: The final total amount to be paid. Look for:
   - Labels like "Total", "Amount Due", "Grand Total", "Totale", "Gesamtbetrag"
   - The largest monetary value at the bottom of the invoice
   - Currency symbols: €, CHF, $, £

4. **CURRENCY**: The currency code (EUR, CHF, USD, GBP, etc.)

5. **DUE DATE**: When the invoice payment is due. Look for:
   - "Due Date", "Payment Due", "Due by", "Pay by"
   - "Fällig am", "Zahlbar bis", "Zahlungsfrist"
   - "Scadenza", "Date d'échéance"
   - "Terms: Net 30" (calculate 30 days from issue date if visible)
   - Return in YYYY-MM-DD format

Return ONLY a JSON object with this EXACT format (no markdown, no code blocks, no extra text):
{"supplier_name": "<company_name>", "invoice_reference": "<invoice_number>", "amount": <number>, "currency": "<ISO_code>", "due_date": "<YYYY-MM-DD>", "confidence": <0-1>}

If you cannot find a field clearly, use null for that field. Examples:
- Full extraction: {"supplier_name": "Interrentcars AG", "invoice_reference": "Rechnung 10122", "amount": 1234.56, "currency": "EUR", "due_date": "2026-02-15", "confidence": 0.95}
- Partial extraction: {"supplier_name": "Premium Rentals", "invoice_reference": null, "amount": 500.00, "currency": "CHF", "due_date": null, "confidence": 0.7}
- No clear data: {"supplier_name": null, "invoice_reference": null, "amount": null, "currency": null, "due_date": null, "confidence": 0}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      
      // PDFs sometimes fail with vision API, provide helpful message
      if (isPDF) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unable to analyze PDF automatically. Please enter the details manually.',
            needsManualInput: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log('AI Response:', aiResult);

    const content = aiResult.choices?.[0]?.message?.content || '';
    console.log('AI extracted content:', content);

    // Parse the JSON response
    let extractedData;
    try {
      // Clean the response to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = { supplier_name: null, invoice_reference: null, amount: null, currency: null, due_date: null, confidence: 0 };
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      extractedData = { supplier_name: null, invoice_reference: null, amount: null, currency: null, due_date: null, confidence: 0 };
    }

    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        supplier_name: extractedData.supplier_name || null,
        invoice_reference: extractedData.invoice_reference || null,
        amount: extractedData.amount,
        currency: extractedData.currency || 'EUR',
        due_date: extractedData.due_date || null,
        confidence: extractedData.confidence || 0,
        needsManualInput: !extractedData.amount || extractedData.confidence < 0.7
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error extracting invoice data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        needsManualInput: true 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
