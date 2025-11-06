import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://gsiuhsvvmkdfgakhdhex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaXVoc3Z2bWtkZmdha2hkaGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NDg5NDYsImV4cCI6MjA3ODAyNDk0Nn0.30FXBGcq-BS21EpdlvDEqA6bgA0eJPlKJxdUag01C6Y';
export const supabase = createClient(supabaseUrl, supabaseKey);