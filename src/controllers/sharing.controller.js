import { supabase } from "../utils/supabaseClient.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import crypto from "crypto";

/* ============================================================================
   POST /files/:id/share - Share file with specific users
============================================================================ */
const shareFile = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // logged-in user (file owner)
  const { id } = req.params; // file ID
  const { users } = req.body; // array of { user_id, permission } objects

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!Array.isArray(users) || users.length === 0) {
    throw new ApiError({
      statusCode: 422,
      message: "Users array with permissions is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Verify file exists and belongs to current user
  const { data: file, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", id)
    .single();

  if (fetchError || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  if (file.type !== "file") {
    throw new ApiError({
      statusCode: 400,
      message: "Target is not a file",
      errorCode: "INVALID_NODE_TYPE",
    });
  }

  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not own this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Insert sharing permissions
  const permissionEntries = users.map((u) => ({
    node_id: id,
    shared_with: u.user_id,
    permission: u.permission, // e.g. "read" | "write" | "comment"
    granted_by: userId,
  }));

  const { data, error: insertError } = await supabase
    .from("permissions")
    .insert(permissionEntries)
    .select("id, node_id, shared_with, permission, created_at");

  if (insertError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to share file",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, { permissions: data }, "File shared successfully")
    );
});

/* ============================================================================
   POST /folders/:id/share - Share folder with specific users
============================================================================ */
const shareFolder = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // logged-in user
  const { id } = req.params; // folder ID
  const { users } = req.body; // array of { user_id, permission }

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!Array.isArray(users) || users.length === 0) {
    throw new ApiError({
      statusCode: 422,
      message: "Users array with permissions is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Verify folder exists and belongs to user
  const { data: folder, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", id)
    .single();

  if (fetchError || !folder) {
    throw new ApiError({
      statusCode: 404,
      message: "Folder not found",
      errorCode: "FOLDER_NOT_FOUND",
    });
  }

  if (folder.type !== "folder") {
    throw new ApiError({
      statusCode: 400,
      message: "Target is not a folder",
      errorCode: "INVALID_NODE_TYPE",
    });
  }

  if (folder.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not own this folder",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Insert permissions
  const permissionEntries = users.map((u) => ({
    node_id: id,
    shared_with: u.user_id,
    permission: u.permission, // "read" | "write" | "comment"
    granted_by: userId,
  }));

  const { data, error: insertError } = await supabase
    .from("permissions")
    .insert(permissionEntries)
    .select("id, node_id, shared_with, permission, created_at");

  if (insertError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to share folder",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, { permissions: data }, "Folder shared successfully")
    );
});

/* ============================================================================
   GET /files/:id/permissions - Get all permissions for a file
============================================================================ */
const getFilePermissions = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // logged-in user
  const { id } = req.params; // file ID

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Verify file exists
  const { data: file, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", id)
    .single();

  if (fetchError || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  if (file.type !== "file") {
    throw new ApiError({
      statusCode: 400,
      message: "Target is not a file",
      errorCode: "INVALID_NODE_TYPE",
    });
  }

  // ✅ Only file owner can fetch permissions
  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not have permission to view this file’s permissions",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Fetch permissions
  const { data: permissions, error: permError } = await supabase
    .from("permissions")
    .select(
      `
      id,
      shared_with,
      permission,
      created_at,
      users:user_id (id, email, full_name)
      `
    )
    .eq("node_id", id);

  if (permError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to fetch file permissions",
      errorCode: "DB_QUERY_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { fileId: id, permissions },
        "File permissions retrieved successfully"
      )
    );
});

/* ============================================================================
   PUT /files/:id/permissions - Update file permissions
============================================================================ */
const updateFilePermissions = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // logged-in user
  const { id } = req.params; // file ID
  const { permissionId, permission } = req.body; // new permission level

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!permissionId || !permission) {
    throw new ApiError({
      statusCode: 422,
      message: "Permission ID and new permission are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Verify file exists
  const { data: file, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", id)
    .single();

  if (fetchError || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  if (file.type !== "file") {
    throw new ApiError({
      statusCode: 400,
      message: "Target is not a file",
      errorCode: "INVALID_NODE_TYPE",
    });
  }

  // ✅ Only owner can update permissions
  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You cannot update permissions for this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Check if permission entry exists
  const { data: existingPermission, error: checkError } = await supabase
    .from("permissions")
    .select("id, node_id")
    .eq("id", permissionId)
    .eq("node_id", id)
    .single();

  if (checkError || !existingPermission) {
    throw new ApiError({
      statusCode: 404,
      message: "Permission not found for this file",
      errorCode: "PERMISSION_NOT_FOUND",
    });
  }

  // 3. Update permission
  const { data: updatedPermission, error: updateError } = await supabase
    .from("permissions")
    .update({
      permission,
      updated_at: new Date().toISOString(),
    })
    .eq("id", permissionId)
    .select("id, permission, updated_at")
    .single();

  if (updateError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to update permission",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { permission: updatedPermission },
        "Permission updated successfully"
      )
    );
});

/* ============================================================================
   DELETE /files/:id/permissions/:permissionId - Remove specific permission
============================================================================ */
const removeFilePermission = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // logged-in user
  const { id, permissionId } = req.params; // file ID & permission ID

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Verify file exists
  const { data: file, error: fileError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", id)
    .single();

  if (fileError || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  if (file.type !== "file") {
    throw new ApiError({
      statusCode: 400,
      message: "Target is not a file",
      errorCode: "INVALID_NODE_TYPE",
    });
  }

  // ✅ Only owner can remove permissions
  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You cannot remove permissions from this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Check if permission exists for this file
  const { data: existingPermission, error: permError } = await supabase
    .from("permissions")
    .select("id")
    .eq("id", permissionId)
    .eq("node_id", id)
    .single();

  if (permError || !existingPermission) {
    throw new ApiError({
      statusCode: 404,
      message: "Permission not found for this file",
      errorCode: "PERMISSION_NOT_FOUND",
    });
  }

  // 3. Delete the permission entry
  const { error: deleteError } = await supabase
    .from("permissions")
    .delete()
    .eq("id", permissionId);

  if (deleteError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to remove permission",
      errorCode: "DB_DELETE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { removedPermissionId: permissionId },
        "Permission removed successfully"
      )
    );
});

/* ============================================================================
   POST /files/:id/public-link - Generate public sharing link
============================================================================ */
const generatePublicLink = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // logged-in user
  const { id } = req.params; // file ID

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Check if file exists
  const { data: file, error: fileError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", id)
    .single();

  if (fileError || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  if (file.type !== "file") {
    throw new ApiError({
      statusCode: 400,
      message: "Target is not a file",
      errorCode: "INVALID_NODE_TYPE",
    });
  }

  // ✅ Only owner can generate public link
  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You cannot generate public links for this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Check if a link already exists
  const { data: existingLink } = await supabase
    .from("public_links")
    .select("id, token, created_at")
    .eq("node_id", id)
    .single();

  if (existingLink) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          token: existingLink.token,
          url: `${process.env.APP_BASE_URL}/public/${existingLink.token}`,
        },
        "Public link already exists"
      )
    );
  }

  // 3. Generate a random token
  const token = crypto.randomBytes(16).toString("hex"); // secure unique link

  // 4. Save token in DB
  const { data: newLink, error: insertError } = await supabase
    .from("public_links")
    .insert([
      {
        node_id: id,
        token,
        owner_id: userId,
      },
    ])
    .select("id, token, created_at")
    .single();

  if (insertError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to generate public link",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        token: newLink.token,
        url: `${process.env.APP_BASE_URL}/public/${newLink.token}`,
      },
      "Public link generated successfully"
    )
  );
});

/* ============================================================================
   GET /public/:token - Access public file/folder
============================================================================ */
const accessPublicResource = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token || token.trim() === "") {
    throw new ApiError({
      statusCode: 400,
      message: "Token is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Lookup token in `public_links`
  const { data: publicLink, error: linkError } = await supabase
    .from("public_links")
    .select("id, token, node_id, created_at")
    .eq("token", token)
    .single();

  if (linkError || !publicLink) {
    throw new ApiError({
      statusCode: 404,
      message: "Invalid or expired public link",
      errorCode: "LINK_NOT_FOUND",
    });
  }

  // 2. Fetch the file/folder metadata
  const { data: node, error: nodeError } = await supabase
    .from("nodes")
    .select(
      "id, name, type, mime_type, size_bytes, parent_id, created_at, updated_at, path"
    )
    .eq("id", publicLink.node_id)
    .is("deleted_at", null)
    .single();

  if (nodeError || !node) {
    throw new ApiError({
      statusCode: 404,
      message: "Shared resource not found",
      errorCode: "RESOURCE_NOT_FOUND",
    });
  }

  // 3. If it’s a file, optionally generate signed URL for download
  let signedUrl = null;
  if (node.type === "file") {
    const { data: signed } = await supabase.storage
      .from("files")
      .createSignedUrl(node.path, 60 * 60); // valid 1h

    if (signed?.signedUrl) {
      signedUrl = signed.signedUrl;
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        node,
        publicLink: {
          token: publicLink.token,
          created_at: publicLink.created_at,
        },
        downloadUrl: signedUrl,
      },
      "Public resource retrieved successfully"
    )
  );
});

/* ============================================================================
   POST /files/:id/signed-url - Generate signed download URL
============================================================================ */
const generateSignedUrl = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { expiresIn = 3600 } = req.body; // default 1 hour

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Fetch file metadata
  const { data: file, error: fileError } = await supabase
    .from("nodes")
    .select("id, owner_id, type, name, path, mime_type, size_bytes")
    .eq("id", id)
    .single();

  if (fileError || !file) {
    throw new ApiError({
      statusCode: 404,
      message: "File not found",
      errorCode: "FILE_NOT_FOUND",
    });
  }

  if (file.type !== "file") {
    throw new ApiError({
      statusCode: 400,
      message: "Target is not a file",
      errorCode: "INVALID_NODE_TYPE",
    });
  }

  // 2. Permission check (only owner for now — later extend to shared users)
  if (file.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not have access to this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 3. Generate signed URL from Supabase storage
  const { data: signed, error: signedError } = await supabase.storage
    .from("files") // bucket name
    .createSignedUrl(file.path, expiresIn);

  if (signedError || !signed?.signedUrl) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to generate signed URL",
      errorCode: "SIGNED_URL_FAILED",
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        file: {
          id: file.id,
          name: file.name,
          mime_type: file.mime_type,
          size_bytes: file.size_bytes,
        },
        signedUrl: signed.signedUrl,
        expiresIn,
      },
      "Signed download URL generated successfully"
    )
  );
});

export {
  shareFile,
  shareFolder,
  getFilePermissions,
  updateFilePermissions,
  removeFilePermission,
  generatePublicLink,
  accessPublicResource,
  generateSignedUrl,
};
