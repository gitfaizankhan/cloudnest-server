// supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// ✅ Replace with your Supabase project URL and Service Role Key
const supabaseUrl = "https://hyfqmtcjotudgarjimnk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZnFtdGNqb3R1ZGdhcmppbW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDU5OTc4NywiZXhwIjoyMDcwMTc1Nzg3fQ.rITIBg2KfctyegVQTAR5oBdfcE-x97WWkoDxWtzX2nE";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // For Node.js you usually want this false
    autoRefreshToken: false, // Manage refresh manually in backend
  },
});
