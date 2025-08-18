import { Router } from "express";
import {
  getMe,
  login,
  logout,
  refreshToken,
  signUp,
  googleAuth,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(signUp);
router.route("/login").post(login);
router.route("/logout").post(logout);
router.route("/refresh-token").post(refreshToken);
router.route("/me").get(getMe);
router.route("/google").post(googleAuth);
router.route("/verify-email").post(verifyEmail);
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);

export default router;
