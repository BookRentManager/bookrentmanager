import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { message_id } = await req.json();

    console.log(`Processing message ${message_id} for Telegram sync`);

    // Get the message with user profile
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        profiles (
          display_name,
          email
        )
      `)
      .eq('id', message_id)
      .single();

    if (messageError || !message) {
      console.error('Message not found:', messageError);
      throw new Error('Message not found');
    }

    // Only sync webapp messages (prevent loops)
    if (message.source !== 'webapp') {
      console.log('Message not from webapp, skipping sync');
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if Telegram sync is enabled for this entity
    const { data: config, error: configError } = await supabase
      .from('telegram_config')
      .select('*')
      .eq('entity_type', message.entity_type)
      .eq('is_enabled', true)
      .limit(1)
      .single();

    if (configError || !config) {
      console.log('No active Telegram config for this entity');
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For non-general chats, verify entity_id matches
    if (message.entity_type !== 'general' && config.entity_id !== message.entity_id) {
      console.log('Entity ID mismatch, skipping');
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const telegramChatId = config.telegram_chat_id;
    const displayName = message.profiles?.display_name || message.profiles?.email || 'Unknown User';
    
    // Format message with sender name
    const formattedText = `${displayName}: ${message.message}`;

    console.log(`Sending to Telegram chat ${telegramChatId}: ${formattedText}`);

    // Send to Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: formattedText,
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API error:', telegramData);
      throw new Error(`Telegram API error: ${JSON.stringify(telegramData)}`);
    }

    console.log('Message sent to Telegram:', telegramData);

    // Update message with Telegram message ID
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({
        telegram_message_id: telegramData.result.message_id.toString(),
        telegram_chat_id: telegramChatId,
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
    }

    return new Response(JSON.stringify({ ok: true, telegram_message_id: telegramData.result.message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in telegram-send function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
