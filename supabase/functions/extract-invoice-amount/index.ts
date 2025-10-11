import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
          error: 'PDF file is too large for automatic analysis. Please enter the amount manually.',
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

    // Call Lovable AI to extract invoice amount
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
                  text: 'You are analyzing an invoice document. Your task is to find the FINAL TOTAL AMOUNT that needs to be paid. Look for:\n\n1. Labels like "Total", "Total Amount", "Amount Due", "Total Due", "Grand Total", "Totale", "Importo Totale", "Net Total", "Total to Pay"\n2. The LARGEST monetary value on the invoice (this is usually the total)\n3. The amount at the bottom of the invoice\n4. Any amount marked as "payable" or "to be paid"\n\nIMPORTANT: Return ONLY a JSON object with this EXACT format (no markdown, no code blocks, no extra text):\n{"amount": <number>, "currency": "<ISO_code>", "confidence": <0-1>}\n\nIf you cannot find a clear total amount, return:\n{"amount": null, "currency": null, "confidence": 0}\n\nExamples:\n- If you see "Total: €1,234.56", return: {"amount": 1234.56, "currency": "EUR", "confidence": 0.95}\n- If you see "Total CHF 500.00", return: {"amount": 500.00, "currency": "CHF", "confidence": 0.95}'
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
          max_tokens: 200
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
            error: 'Unable to analyze PDF automatically. Please enter the amount manually.',
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
        extractedData = { amount: null, currency: null, confidence: 0 };
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      extractedData = { amount: null, currency: null, confidence: 0 };
    }

    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        amount: extractedData.amount,
        currency: extractedData.currency || 'EUR',
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
    console.error('Error extracting invoice amount:', error);
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
