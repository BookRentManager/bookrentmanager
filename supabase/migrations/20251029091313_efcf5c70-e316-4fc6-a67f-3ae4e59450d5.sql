-- Add 'rental' to the message_entity_type enum for chat functionality
-- This allows rental-specific chat conversations

ALTER TYPE message_entity_type ADD VALUE IF NOT EXISTS 'rental';