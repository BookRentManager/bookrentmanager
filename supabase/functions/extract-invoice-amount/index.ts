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

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = file.type || 'application/pdf';
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
                text: 'Please analyze this invoice and extract the TOTAL AMOUNT. Look for terms like "Total", "Total Amount", "Amount Due", "Total Due", "Grand Total", "Totale", "Importo Totale", etc. Return ONLY a JSON object with this exact format: {"amount": <number>, "currency": "<currency_code>", "confidence": <0-1>}. If you cannot find the total amount, return {"amount": null, "currency": null, "confidence": 0}. Do not include any other text.'
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
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
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
