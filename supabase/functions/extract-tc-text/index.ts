import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";

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
    const pdfData = new Uint8Array(arrayBuffer);

    console.log('Parsing PDF...');

    // Load PDF document using pdfjs-dist
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDoc = await loadingTask.promise;
    
    console.log('PDF loaded. Pages:', pdfDoc.numPages);

    // Extract text from all pages
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    console.log('Text extracted. Length:', fullText.length);

    // Clean up the extracted text
    const cleanedText = fullText
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
      .trim();

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error('Could not extract meaningful text from PDF. The PDF might be image-based or encrypted. Please enter the content manually.');
    }

    console.log('Text extracted successfully:', cleanedText.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ 
        text: cleanedText,
        success: true,
        pages: pdfDoc.numPages,
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
