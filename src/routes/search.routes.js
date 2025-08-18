// routes/star.routes.js
import express from "express";
import {
  searchNodes,
  getRecentFiles,
  getStarredFiles,
  markFileAsStarred,
  removeFileFromStarred,
} from "../controllers/search.controller.js";

const router = express.Router();

/* ================================
   Search & Discovery Routes
================================ */

// Global search
router.get("/search", searchNodes);

// Recently accessed files
router.get("/files/recent", getRecentFiles);

// Starred/favorite files
router.get("/files/starred", getStarredFiles);

// Mark file as favorite
router.post("/files/:id/star", markFileAsStarred);

// Remove file from favorites
router.delete("/files/:id/star", removeFileFromStarred);

export default router;
