import multer from "multer";
import AWS from "aws-sdk";
import { supabase } from "../utils/supabaseClient.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Multer config (in memory storage for direct S3 upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// AWS S3 config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/* ============================================================================
   Upload File
============================================================================ */
const uploadFile = asyncHandler(async (req, res) => {
  const file = req.file;
  const userId = req.user?.id || null; // assume middleware sets req.user

  if (!file) {
    throw new ApiError({
      statusCode: 400,
      message: "No file uploaded",
      errorCode: "FILE_MISSING",
    });
  }

  // 1. Upload to S3
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${userId}/${Date.now()}_${file.originalname}`, // unique path
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const s3Response = await s3.upload(params).promise();

  // 2. Save metadata to DB
  const { error: dbError } = await supabase.from("nodes").insert([
    {
      owner_id: userId,
      type: "file",
      name: file.originalname,
      size_bytes: file.size,
      mime_type: file.mimetype,
      // custom metadata
      path: s3Response.Key, // saved file path
    },
  ]);

  if (dbError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to save file metadata",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  // 3. Response
  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { url: s3Response.Location },
        "File uploaded successfully"
      )
    );
});

/* ============================================================================
   Download File by ID
============================================================================ */
const downloadFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || null;

  // 1. Get file metadata
  const { data: file, error: fileError } = await supabase
    .from("nodes")
    .select("id, owner_id, name, mime_type, path")
    .eq("id", id)
    .single();

  if (fileError || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  // (Optional) Check ownership or sharing permission
  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not have permission to access this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Get file from S3
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: file.path,
  };

  try {
    const s3Stream = s3.getObject(params).createReadStream();

    // Set response headers
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);

    // Pipe S3 stream to response
    s3Stream.pipe(res);
  } catch (err) {
    throw new ApiError({
      statusCode: 500,
      message: "Error downloading file",
      errorCode: "DOWNLOAD_ERROR",
    });
  }
});

/* ============================================================================
   Get File Metadata by ID
============================================================================ */
const getFileMetadata = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || null;

  // 1. Query DB for file metadata
  const { data: file, error } = await supabase
    .from("nodes")
    .select(
      "id, owner_id, name, size_bytes, mime_type, path, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (error || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  // 2. Verify permissions (owner or shared)
  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not have permission to view this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 3. Return metadata
  return res
    .status(200)
    .json(new ApiResponse(200, { file }, "File metadata fetched successfully"));
});

/* ============================================================================
   Upload Chunk (Multipart)
============================================================================ */
const uploadFileChunk = asyncHandler(async (req, res) => {
  const { uploadId, partNumber, key } = req.body;
  const chunk = req.file;

  if (!uploadId || !partNumber || !key) {
    throw new ApiError({
      statusCode: 422,
      message: "uploadId, partNumber, and key are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  if (!chunk) {
    throw new ApiError({
      statusCode: 400,
      message: "No chunk uploaded",
      errorCode: "CHUNK_MISSING",
    });
  }

  // Upload chunk to S3 multipart upload
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: parseInt(partNumber, 10),
    Body: chunk.buffer,
  };

  try {
    const response = await s3.uploadPart(params).promise();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ETag: response.ETag,
          PartNumber: partNumber,
        },
        "Chunk uploaded successfully"
      )
    );
  } catch (err) {
    throw new ApiError({
      statusCode: 500,
      message: "Error uploading chunk",
      errorCode: "CHUNK_UPLOAD_FAILED",
    });
  }
});

/* ============================================================================
   Complete Multipart Upload
============================================================================ */
const completeChunkUpload = asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const { key, parts, name, size_bytes, mime_type } = req.body;
  const userId = req.user?.id || null;

  if (!uploadId || !key || !parts) {
    throw new ApiError({
      statusCode: 422,
      message: "uploadId, key, and parts are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  try {
    // 1. Complete multipart upload in S3
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts, // [{ ETag, PartNumber }]
      },
    };

    const s3Response = await s3.completeMultipartUpload(params).promise();

    // 2. Save metadata in DB (nodes table)
    const { data, error: dbError } = await supabase
      .from("nodes")
      .insert([
        {
          owner_id: userId,
          type: "file",
          name,
          size_bytes,
          mime_type,
          path: key,
        },
      ])
      .select("id")
      .single();

    if (dbError) {
      throw new ApiError({
        statusCode: 500,
        message: "Failed to save file metadata",
        errorCode: "DB_INSERT_FAILED",
      });
    }

    // 3. Respond with success
    return res.status(201).json(
      new ApiResponse(
        201,
        {
          fileId: data.id,
          location: s3Response.Location,
        },
        "File upload completed successfully"
      )
    );
  } catch (err) {
    throw new ApiError({
      statusCode: 500,
      message: err.message || "Error completing multipart upload",
      errorCode: "UPLOAD_COMPLETE_FAILED",
    });
  }
});

export {
  upload,
  uploadFile,
  downloadFile,
  getFileMetadata,
  uploadFileChunk,
  completeChunkUpload,
};
