// Error Code
const ERROR_CODES = {
  // 🔐 Authentication Errors
  UNAUTHORIZED: 401, // Invalid token or credentials
  FORBIDDEN: 403, // No permission to access
  NOT_AUTHENTICATED: 440, // Custom: Session expired

  // 📁 File & Folder Errors
  FILE_NOT_FOUND: 404,
  FILE_TOO_LARGE: 413, // Payload too large
  FILE_CONFLICT: 409, // File already exists
  FILE_UNSUPPORTED_TYPE: 415, // Unsupported media type

  FOLDER_NOT_FOUND: 404,
  FOLDER_CONFLICT: 409,

  // 🔗 Sharing & Access Errors
  SHARE_LINK_INVALID: 400,
  PERMISSION_DENIED: 403,

  // 💾 Database / Server Errors
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  DUPLICATE_RESOURCE: 409,
  INTERNAL_ERROR: 500,
  DB_CONNECTION_FAILED: 503, // Service unavailable

  // 📦 Supabase-specific
  SUPABASE_UPLOAD_FAILED: 502,
  SUPABASE_DELETE_FAILED: 502,
  SUPABASE_SIGNED_URL_FAILED: 502,

  // 🌐 General
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  RATE_LIMIT_EXCEEDED: 429,
};

export default ERROR_CODES;
