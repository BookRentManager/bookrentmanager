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
    console.log('Extracting text from PDF...');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file type
    if (file.type !== 'application/pdf') {
      throw new Error('File must be a PDF');
    }

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    console.log('Parsing PDF...');

    // Simple text extraction from PDF using basic string parsing
    // This works for text-based PDFs that have embedded text streams
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdfText = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
    
    // Extract text between BT (Begin Text) and ET (End Text) markers
    // This is a simple approach that works for many standard PDFs
    const textMatches = pdfText.match(/BT\s*(.*?)\s*ET/gs) || [];
    
    let extractedText = '';
    for (const match of textMatches) {
      // Extract text strings within parentheses or angle brackets
      const strings = match.match(/\((.*?)\)|<(.*?)>/g) || [];
      for (const str of strings) {
        const cleaned = str.replace(/[()<>]/g, '').trim();
        if (cleaned) {
          extractedText += cleaned + ' ';
        }
      }
    }

    // If the above method didn't work well, try extracting all readable text
    if (!extractedText || extractedText.length < 100) {
      // Fallback: extract any printable text from the PDF
      const allText = pdfText
        .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Try to find reasonable text content (more than just PDF structure)
      const textSegments = allText.split(/(?:obj|endobj|stream|endstream)/);
      extractedText = textSegments
        .filter(seg => seg.length > 20 && /[a-zA-Z]{3,}/.test(seg))
        .join(' ')
        .trim();
    }

    console.log('Text extracted. Length:', extractedText.length);

    // Clean up the extracted text
    const cleanedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\\n/g, '\n') // Convert escaped newlines
      .trim();

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error('Could not extract meaningful text from PDF. The PDF might be image-based or encrypted. Please enter the content manually.');
    }

    console.log('Text extracted successfully:', cleanedText.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ 
        text: cleanedText,
        success: true,
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
        error: error.message || 'Failed to extract text from PDF',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
