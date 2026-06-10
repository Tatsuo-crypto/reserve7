-- Add separate push notification preference for each member.
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notification_enabled BOOLEAN DEFAULT false;

-- Keep existing members opted out until they explicitly allow app notifications.
UPDATE users
SET push_notification_enabled = false
WHERE push_notification_enabled IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
