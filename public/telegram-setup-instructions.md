# Telegram Integration Setup Guide

## Overview
BookRentManager's Telegram integration allows your team to use Telegram groups as an alternative interface to the webapp chat. Messages sync bidirectionally in real-time!

## Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send the command: `/newbot`
3. Follow the prompts:
   - Choose a name for your bot (e.g., "BookRentManager Bot")
   - Choose a username (must end in 'bot', e.g., "bookrentmanager_bot")
4. **Copy the bot token** - it looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
5. Keep this token safe - you'll need it in Step 4!

## Step 2: Create and Configure Your Telegram Group

1. Create a new Telegram group (or use an existing one)
2. Add your bot to the group:
   - Click the group name → Add members
   - Search for your bot's username
   - Add it to the group
3. **Promote the bot to admin** (required for the bot to read messages):
   - Click the group name → Administrators
   - Add your bot as an administrator
   - Grant permissions to read messages

## Step 3: Get Your Chat ID

### Option A: Using @RawDataBot (Easiest)
1. Add **@RawDataBot** to your group
2. It will immediately send a message showing your chat details
3. Look for the `"id"` field - it will be a negative number like `-1001234567890`
4. Copy this number (including the minus sign!)
5. Remove @RawDataBot from the group

### Option B: Using Telegram API
1. Send any message in your group
2. Visit this URL in your browser (replace `YOUR_BOT_TOKEN` with your actual token):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Look for `"chat":{"id":-1001234567890` in the response
4. Copy the chat ID (negative number)

## Step 4: Configure in BookRentManager

1. Log into BookRentManager as an admin
2. Go to **Integrations** page
3. Find the **Telegram Integration** section
4. Click **Configure New Sync**
5. Fill in the form:
   - **Bot Token**: Paste the token from Step 1
   - **Chat Context**: Choose what this Telegram group represents:
     - `General Chat`: For team-wide general discussions
     - Specific booking/invoice/fine: Link to a specific entity
   - **Telegram Chat ID**: Paste the chat ID from Step 3
   - **Enable Sync**: Toggle to ON
6. Click **Save Configuration**

## Step 5: Set Webhook (Automatic)

When you save the configuration, BookRentManager will automatically register the webhook with Telegram. This allows Telegram to send messages to your webapp.

The webhook URL will be:
```
https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/telegram-bot
```

## Testing Your Integration

### Test 1: Webapp → Telegram
1. Go to the chat in BookRentManager (General or entity-specific)
2. Send a test message
3. Check your Telegram group - the message should appear instantly!

### Test 2: Telegram → Webapp
1. Send a message in your Telegram group
2. Check the webapp chat - the message should appear in real-time!

### Test 3: @Mentions
1. @mention a team member in the webapp
2. They should see the mention in Telegram
3. Try the reverse: @mention in Telegram, check webapp notifications

## Troubleshooting

### Messages not appearing in Telegram
- Verify the bot is an admin in the group
- Check that sync is enabled in BookRentManager
- Check edge function logs for errors

### Messages not appearing in webapp
- Verify the chat ID is correct (negative number)
- Ensure the bot token is valid
- Check that the webhook is registered:
  ```
  https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo
  ```

### User mapping issues
- Webapp tries to match Telegram usernames to display names or emails
- If no match found, messages appear from the admin who configured the sync
- Solution: Ask team members to set their display name in BookRentManager to match their Telegram username

## Advanced Configuration

### Multiple Telegram Groups
You can configure multiple Telegram groups for different contexts:
- One group for general team chat
- Separate groups for different bookings
- Dedicated groups for urgent issues

### Disabling Sync Temporarily
1. Go to Integrations → Telegram
2. Find the sync configuration
3. Toggle **Enable Sync** to OFF
4. Messages will stop syncing until you re-enable it

### Deleting a Sync
1. Go to Integrations → Telegram
2. Click the delete icon next to the sync configuration
3. Confirm deletion
4. The Telegram group will still exist, but messages won't sync anymore

## Security Notes

- Bot tokens are stored securely in BookRentManager's backend
- Never share your bot token publicly
- Only admins can configure Telegram integrations
- All messages sync according to existing RLS (Row Level Security) policies
- If a user doesn't have access to an entity in the webapp, they won't receive messages about it even if they're in the Telegram group

## Support

If you encounter issues:
1. Check the edge function logs in the backend
2. Verify webhook status with Telegram
3. Ensure all team members have proper permissions in both systems
4. Contact support if issues persist

---

**Enjoy seamless team communication across web and Telegram! 🚀**
