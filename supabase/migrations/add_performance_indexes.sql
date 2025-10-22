-- Performance optimization: Add indexes for frequently queried columns
-- This migration adds database indexes to speed up common queries

-- Reservations table indexes
CREATE INDEX IF NOT EXISTS idx_reservations_calendar_id ON reservations(calendar_id);
CREATE INDEX IF NOT EXISTS idx_reservations_client_id ON reservations(client_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_time ON reservations(start_time);
CREATE INDEX IF NOT EXISTS idx_reservations_calendar_start ON reservations(calendar_id, start_time);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Stores table indexes
CREATE INDEX IF NOT EXISTS idx_stores_calendar_id ON stores(calendar_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reservations_calendar_client_time 
  ON reservations(calendar_id, client_id, start_time);

CREATE INDEX IF NOT EXISTS idx_users_store_status 
  ON users(store_id, status);

-- Partial indexes for active users only (most common query)
CREATE INDEX IF NOT EXISTS idx_users_active_store 
  ON users(store_id) WHERE status = 'active';

COMMENT ON INDEX idx_reservations_calendar_id IS 'Speed up queries filtering by calendar_id';
COMMENT ON INDEX idx_reservations_start_time IS 'Speed up queries ordering by start_time';
COMMENT ON INDEX idx_users_access_token IS 'Speed up member authentication by access token';
