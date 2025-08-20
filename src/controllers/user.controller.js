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

// Cookie options for access and refresh tokens
const cookieOptions = {
  httpOnly: true,
  secure: true,
};

const signUp = asyncHandler(async (req, res) => {
  console.log("Req.body: ", req.body);
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


  return res.status(201).json(
    new ApiResponse(201, {
      user: data.user,
      username,
    })
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError({
      statusCode: 422,
      message: "Email and password are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new ApiError({
      statusCode: 401,
      message: error.message,
      errorCode: "AUTH_FAILED",
    });
  }

  // Extract access and refresh tokens from session (data.session)
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    user,
  } = data.session || {};

  if (!accessToken || !refreshToken) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to generate authentication tokens",
      errorCode: "TOKEN_ERROR",
    });
  }

  // Set secure httpOnly cookies
  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user }, "User logged in successfully"));
});

const logout = asyncHandler(async (req, res) => {
  try {
    // Invalidate Supabase session
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new ApiError({
        statusCode: 500,
        message: error.message,
        errorCode: "LOGOUT_FAILED",
      });
    }

    // Clear cookies storing access & refresh tokens
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "User logged out successfully"));
  } catch (err) {
    throw new ApiError({
      statusCode: 500,
      message: "Logout failed",
      errorCode: "LOGOUT_ERROR",
    });
  }
});

const refreshToken = asyncHandler(async (req, res) => {
  // 1. Extract refresh token from cookies
  const refreshTokenCookie = req.cookies?.refreshToken;

  if (!refreshTokenCookie) {
    throw new ApiError({
      statusCode: 401,
      message: "Refresh token missing. Please login again.",
      errorCode: "TOKEN_MISSING",
    });
  }

  // 2. Use Supabase to refresh session
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshTokenCookie,
  });

  if (error) {
    throw new ApiError({
      statusCode: 401,
      message: "Invalid or expired refresh token",
      errorCode: "TOKEN_INVALID",
    });
  }

  // 3. Extract new tokens
  const {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    user,
  } = data.session || {};

  if (!newAccessToken || !newRefreshToken) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to refresh authentication tokens",
      errorCode: "TOKEN_REFRESH_ERROR",
    });
  }

  // 4. Set new cookies
  res
    .cookie("accessToken", newAccessToken, cookieOptions)
    .cookie("refreshToken", newRefreshToken, cookieOptions);

  // 5. Respond with success
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed successfully"
    )
  );
});

const getMe = asyncHandler(async (req, res) => {
  // 1. Extract access token from cookies
  const accessToken = req.cookies?.accessToken;

  if (!accessToken) {
    throw new ApiError({
      statusCode: 401,
      message: "Access token missing. Please login again.",
      errorCode: "TOKEN_MISSING",
    });
  }

  // 2. Get user session from Supabase
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new ApiError({
      statusCode: 401,
      message: "Invalid or expired token",
      errorCode: "TOKEN_INVALID",
    });
  }

  // 3. Fetch extended profile info (from your "users" table)
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(
      "id, email, username, full_name, phone, email_confirmed, created_at"
    )
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to fetch user profile",
      errorCode: "PROFILE_ERROR",
    });
  }

  // 4. Return profile data
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: profile },
        "User profile fetched successfully"
      )
    );
});

const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body; // Google ID token sent from frontend

  if (!idToken) {
    throw new ApiError({
      statusCode: 422,
      message: "Google ID token is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Exchange Google ID token for Supabase session
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error || !data?.session) {
    throw new ApiError({
      statusCode: 401,
      message: error?.message || "Google login failed",
      errorCode: "AUTH_FAILED",
    });
  }

  // 2. Extract tokens & user
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    user,
  } = data.session;

  // 3. Ensure user exists in your "users" table
  const { error: dbError } = await supabase.from("users").upsert(
    [
      {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.full_name || user.email?.split("@")[0],
        full_name: user.user_metadata?.full_name || null,
        email_confirmed: user.email_confirmed,
        phone: user.user_metadata?.phone || null,
      },
    ],
    { onConflict: "id" } // update if exists
  );

  if (dbError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to save user profile",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  // 4. Set tokens as cookies
  res
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions);

  // 5. Respond with user data
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user,
        accessToken,
        refreshToken,
      },
      "User logged in with Google successfully"
    )
  );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new ApiError({
      statusCode: 422,
      message: "Verification token is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Verify the token with Supabase
  const { data, error } = await supabase.auth.verifyOtp({
    token,
    type: "email", // email confirmation type
  });

  if (error || !data?.user) {
    throw new ApiError({
      statusCode: 400,
      message: error?.message || "Invalid or expired token",
      errorCode: "TOKEN_INVALID",
    });
  }

  // 2. Update custom users table (mark email confirmed)
  const { error: dbError } = await supabase
    .from("users")
    .update({ email_confirmed: true })
    .eq("id", data.user.id);

  if (dbError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to update user profile",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  // 3. Respond with success
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { userId: data.user.id },
        "Email verified successfully"
      )
    );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError({
      statusCode: 422,
      message: "Email is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Request Supabase to send reset password email
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    // This is the frontend route user will land on after clicking email link
  });

  if (error) {
    throw new ApiError({
      statusCode: 400,
      message: error.message,
      errorCode: "RESET_REQUEST_FAILED",
    });
  }

  // 2. Return success
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset email sent successfully"));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    throw new ApiError({
      statusCode: 422,
      message: "New password is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  if (newPassword.length < 6) {
    throw new ApiError({
      statusCode: 422,
      message: "Password must be at least 6 characters long",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Update user password via Supabase
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new ApiError({
      statusCode: 400,
      message: error.message,
      errorCode: "RESET_FAILED",
    });
  }

  // 2. Return success
  return res
    .status(200)
    .json(
      new ApiResponse(200, { user: data.user }, "Password reset successfully")
    );
});

export {
  signUp,
  login,
  logout,
  refreshToken,
  getMe,
  googleAuth,
  verifyEmail,
  forgotPassword,
  resetPassword,
};
