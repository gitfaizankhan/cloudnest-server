import bcrypt from "bcrypt";
import { supabase } from "../utils/supabaseClient.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const SALT_ROUNDS = 10;

// Helper to generate username from email
function generateUsername(email) {
  const namePart = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${namePart}${randomNum}`;
}

const signUp = asyncHandler(async (req, res) => {
  const { email, password, full_name = null, phone = null } = req.body;

  // 1. Validate input
  if (!email || !password) {
    throw new ApiError({
      statusCode: 422,
      message: "Email and password are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Additional validation (optional)
  if (password.length < 6) {
    throw new ApiError({
      statusCode: 422,
      message: "Password must be at least 6 characters long",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 2. Sign up user with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: full_name, // You can add display_name here
        phone, // And phone number here
      },
    },
  });

  if (error) {
    throw new ApiError({
      statusCode: 400,
      message: error.message,
      errorCode: "SIGNUP_FAILED",
    });
  }

  const userId = data.user.id;

  // 3. Hash the password before storing in DB
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // 4. Generate unique username (simple, without uniqueness check here)
  const username = generateUsername(email);

  // 5. Insert user info into your 'users' table
  const { error: dbError } = await supabase.from("users").insert([
    {
      id: userId,
      email,
      username,
      password_hash: passwordHash,
      full_name,
      phone,
      email_confirmed: false, // You can update this after confirmation if needed
    },
  ]);

  if (dbError) {
    // Optional: rollback Supabase Auth user here if needed (advanced)
    throw new ApiError({
      statusCode: 500,
      message: "Failed to save user profile: " + dbError.message,
      errorCode: "DB_INSERT_FAILED",
    });
  }

  // 6. Return response with user and tokens
  const accessToken = data?.session?.access_token || null;
  const refreshToken = data?.session?.refresh_token || null;

  return res.status(201).json(
    new ApiResponse(201, {
      user: data.user,
      username,
      accessToken,
      refreshToken,
    })
  );
});

export { signUp };
