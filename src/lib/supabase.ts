import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          password_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          password_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          password_hash?: string;
          created_at?: string;
        };
      };
      reservations: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          start_time: string;
          end_time: string;
          notes: string | null;
          external_event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          title: string;
          start_time: string;
          end_time: string;
          notes?: string | null;
          external_event_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          title?: string;
          start_time?: string;
          end_time?: string;
          notes?: string | null;
          external_event_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
};
