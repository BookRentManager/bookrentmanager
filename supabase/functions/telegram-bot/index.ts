import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
    from: {
      id: number;
      username?: string;
      first_name: string;
    };
    text?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update, null, 2));

    const message = update.message;
    if (!message || !message.text) {
      console.log('No message or text in update, ignoring');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const telegramChatId = message.chat.id.toString();
    const telegramMessageId = message.message_id.toString();
    const telegramUsername = message.from.username || message.from.first_name;
    const messageText = message.text;

    console.log(`Message from ${telegramUsername} in chat ${telegramChatId}: ${messageText}`);

    // Find telegram config for this chat
    const { data: config, error: configError } = await supabase
      .from('telegram_config')
      .select('*')
      .eq('telegram_chat_id', telegramChatId)
      .eq('is_enabled', true)
      .single();

    if (configError || !config) {
      console.log(`No active config found for chat ${telegramChatId}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found config:', config);

    // Try to map Telegram username to webapp user
    // First try by display_name, then by email
    let userId: string | null = null;
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .or(`display_name.ilike.%${telegramUsername}%,email.ilike.%${telegramUsername}%`)
      .limit(1)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    if (profile) {
      userId = profile.id;
      console.log(`Mapped Telegram user ${telegramUsername} to webapp user ${profile.display_name || profile.email}`);
    } else {
      // If no user found, use the config creator as fallback
      console.log(`Could not map Telegram user ${telegramUsername} to webapp user, using config creator`);
      userId = config.created_by;
    }

    if (!userId) {
      console.error('No user_id available (config.created_by is null), cannot insert message');
      return new Response(JSON.stringify({ error: 'No user mapping available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Using user_id: ${userId} for message insertion`);

    // Insert message into chat_messages
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        entity_type: config.entity_type,
        entity_id: config.entity_id,
        user_id: userId,
        message: messageText,
        telegram_message_id: telegramMessageId,
        telegram_chat_id: telegramChatId,
        source: 'telegram',
        telegram_user_id: message.from.id.toString(),
        telegram_username: message.from.username || message.from.first_name,
      });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw insertError;
    }

    console.log('Message inserted successfully');

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in telegram-bot function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
