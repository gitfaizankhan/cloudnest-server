import express from "express";
import {
  upload,
  uploadFile,
  downloadFile,
  getFileMetadata,
  uploadFileChunk,
  completeChunkUpload
} from "../controllers/file.controller.js";

const router = express.Router();

// POST /files/upload
router.route("/upload").post(upload.single("file"), uploadFile);
router.route("/download/:id").get(downloadFile);
router.route("/:id/metadata").get(getFileMetadata);
router.route("/upload-chunk").post(upload.single("chunk"), uploadFileChunk);
router.route("/upload-complete/:uploadId").post(completeChunkUpload);

export default router;
