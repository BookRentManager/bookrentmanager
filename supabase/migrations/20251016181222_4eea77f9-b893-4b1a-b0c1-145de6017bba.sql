-- Create message entity type enum
CREATE TYPE message_entity_type AS ENUM ('booking', 'fine', 'supplier_invoice', 'client_invoice');

-- Create chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type message_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  mentioned_users UUID[] DEFAULT '{}',
  parent_message_id UUID REFERENCES chat_messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_messages_entity ON chat_messages(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_messages_mentions ON chat_messages USING GIN(mentioned_users);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_messages
CREATE POLICY "Staff can view chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
    AND deleted_at IS NULL
  );

CREATE POLICY "Staff can create chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );

CREATE POLICY "Staff can update own chat messages"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Create unread messages table
CREATE TABLE chat_unread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  entity_type message_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX idx_chat_unread_user ON chat_unread_messages(user_id);
CREATE INDEX idx_chat_unread_entity ON chat_unread_messages(entity_type, entity_id);

ALTER TABLE chat_unread_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unread messages"
  ON chat_unread_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own unread messages"
  ON chat_unread_messages FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Create notifications table
CREATE TABLE chat_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  entity_type message_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX idx_chat_notifications_user ON chat_notifications(user_id, read);

ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON chat_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON chat_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_notifications;

-- Trigger for updated_at
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();