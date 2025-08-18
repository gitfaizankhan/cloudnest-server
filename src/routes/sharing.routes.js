import express from "express";
import {
  shareFile,
  shareFolder,
  getFilePermissions,
  updateFilePermissions,
  removeFilePermission,
  generatePublicLink,
  accessPublicResource,
  generateSignedUrl,
} from "../controllers/sharing.controller.js";

const router = express.Router();

// POST /files/:id/share → Share file with specific users
router.route("/files/:id/share").post(shareFile);

// POST /folders/:id/share → Share folder with specific users
router.route("/folders/:id/share").post(shareFolder);

// GET /files/:id/permissions → Get all permissions for a file
router.route("/files/:id/permissions").get(getFilePermissions);

// PUT /files/:id/permissions → Update file permissions
router.route("/files/:id/permissions").put(updateFilePermissions);

// DELETE /files/:id/permissions/:permissionId → Remove specific permission
router
  .route("/files/:id/permissions/:permissionId")
  .delete(removeFilePermission);

// POST /files/:id/public-link → Generate public sharing link
router.route("/files/:id/public-link").post(generatePublicLink);

// GET /public/:token → Access public file/folder
router.route("/public/:token").get(accessPublicResource);

// POST /files/:id/signed-url → Generate signed download URL
router.route("/files/:id/signed-url").post(generateSignedUrl);

export default router;
