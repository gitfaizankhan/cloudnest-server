// supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// ✅ Replace with your Supabase project URL and Service Role Key
const supabaseUrl = "https://qbdimkblhjijfxehznos.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZGlta2JsaGppamZ4ZWh6bm9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA2MzU5MCwiZXhwIjoyMDcwNjM5NTkwfQ.EG4FQ7irjTsVB5dLkYar037Z-GIWYdgOthfrdzLJ8OU";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // For Node.js you usually want this false
    autoRefreshToken: false, // Manage refresh manually in backend
  },
});
