import express from "express";
import {
  listFiles,
  listFolders,
  createFolder,
  renameFile,
  renameFolder,
  softDeleteFile,
  softDeleteFolder,
  copyFile,
  moveFile,
  moveFolder,
  getFolderContents,
} from "../controllers/fileManagement.controller.js";

const router = express.Router();

/* ================================
   Files Routes
================================ */
router.get("/files", listFiles); // List files with pagination
router.put("/files/:id", renameFile); // Rename file
router.delete("/files/:id", softDeleteFile); // Soft delete file
router.post("/files/:id/copy", copyFile); // Copy file
router.post("/files/:id/move", moveFile); // Move file

/* ================================
   Folders Routes
================================ */
router.get("/folders", listFolders); // List folders with pagination
router.post("/folders", createFolder); // Create new folder
router.put("/folders/:id", renameFolder); // Rename folder
router.delete("/folders/:id", softDeleteFolder); // Soft delete folder
router.post("/folders/:id/move", moveFolder); // Move folder
router.get("/folders/:id/contents", getFolderContents); // Get contents

export default router;
