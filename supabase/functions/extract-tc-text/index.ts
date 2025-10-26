import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Simple PDF text extraction (basic implementation)
    // For production, you might want to use a proper PDF parsing library
    const text = new TextDecoder().decode(bytes);
    
    // Extract text between stream markers (basic PDF text extraction)
    const textContent = text
      .split(/stream[\s\S]*?endstream/g)
      .map(section => {
        // Remove PDF operators and extract readable text
        return section
          .replace(/[<>()[\]{}\/\\]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(section => section.length > 20) // Filter out short fragments
      .join('\n\n');

    // Clean up the extracted text
    const cleanedText = textContent
      .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .trim();

    if (!cleanedText || cleanedText.length < 100) {
      throw new Error('Could not extract meaningful text from PDF. Please enter the content manually.');
    }

    return new Response(
      JSON.stringify({ 
        text: cleanedText,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error extracting PDF text:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
