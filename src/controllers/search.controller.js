// controllers/search.controller.js
import { supabase } from "../utils/supabaseClient.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ============================================================================
   GET /search - Global search files and folders
   Query parameters:
   - q (string): search keyword
   - type (optional: "file" | "folder"): filter by type
============================================================================ */
const searchNodes = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { q, type } = req.query;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!q || q.trim() === "") {
    throw new ApiError({
      statusCode: 422,
      message: "Search query is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Build base query
  let query = supabase
    .from("nodes")
    .select(
      `id, name, type, owner_id, mime_type, size_bytes, parent_id, created_at, updated_at`
    )
    .or(`name.ilike.%${q}%,owner_id.eq.${userId},shared_with.eq.${userId}`)
    .is("deleted_at", null);

  // Filter by type if provided
  if (type === "file" || type === "folder") {
    query = query.eq("type", type);
  }

  // Execute query
  const { data: nodes, error } = await query.order("updated_at", {
    ascending: false,
  });

  if (error) {
    throw new ApiError({
      statusCode: 500,
      message: "Error fetching search results",
      errorCode: "DB_QUERY_FAILED",
    });
  }

  // Only include nodes user owns or has permission to view
  const accessibleNodes = nodes.filter(
    (node) => node.owner_id === userId // TODO: extend later for shared permissions
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { results: accessibleNodes },
        `Search results for "${q}" fetched successfully`
      )
    );
});

/* ============================================================================
   GET /files/recent - Get recently accessed files
============================================================================ */
const getRecentFiles = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // Fetch files sorted by last accessed timestamp (or updated_at as fallback)
  const { data: files, error } = await supabase
    .from("nodes")
    .select("id, name, type, mime_type, size_bytes, path, updated_at")
    .eq("owner_id", userId)
    .eq("type", "file")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(20); // limit to 20 recent files

  if (error) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to fetch recent files",
      errorCode: "DB_QUERY_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { recentFiles: files },
        "Recently accessed files fetched successfully"
      )
    );
});

/* ============================================================================
   GET /files/starred - Get starred/favorite files
============================================================================ */
const getStarredFiles = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // Fetch starred files for the user
  const { data: starredFiles, error } = await supabase
    .from("stars")
    .select(
      `id, file_id,
       files:id, files.name, files.type, files.mime_type, files.size_bytes, files.path, files.updated_at`
    )
    .eq("user_id", userId)
    .eq("files.type", "file")
    .is("files.deleted_at", null)
    .order("files.updated_at", { ascending: false });

  if (error) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to fetch starred files",
      errorCode: "DB_QUERY_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { starredFiles },
        "Starred/favorite files fetched successfully"
      )
    );
});

/* ============================================================================
   POST /files/:id/star - Mark file as favorite
============================================================================ */
const markFileAsStarred = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id: fileId } = req.params;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Verify the file exists and is not deleted
  const { data: file, error: fileError } = await supabase
    .from("nodes")
    .select("id, owner_id, type, deleted_at")
    .eq("id", fileId)
    .single();

  if (fileError || !file || file.deleted_at) {
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

  // 2. Check if already starred
  const { data: existingStar } = await supabase
    .from("stars")
    .select("id")
    .eq("user_id", userId)
    .eq("file_id", fileId)
    .single();

  if (existingStar) {
    return res
      .status(200)
      .json(new ApiResponse(200, { fileId }, "File is already starred"));
  }

  // 3. Insert star record
  const { data, error: insertError } = await supabase
    .from("stars")
    .insert([{ user_id: userId, file_id: fileId }])
    .select("id, user_id, file_id")
    .single();

  if (insertError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to mark file as favorite",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { starred: data },
        "File marked as favorite successfully"
      )
    );
});

/* ============================================================================
   DELETE /files/:id/star - Remove file from favorites
============================================================================ */
const removeFileFromStarred = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id: fileId } = req.params;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Verify the file exists and is not deleted
  const { data: file, error: fileError } = await supabase
    .from("nodes")
    .select("id, type, deleted_at")
    .eq("id", fileId)
    .single();

  if (fileError || !file || file.deleted_at) {
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

  // 2. Check if the file is starred by this user
  const { data: existingStar } = await supabase
    .from("stars")
    .select("id")
    .eq("user_id", userId)
    .eq("file_id", fileId)
    .single();

  if (!existingStar) {
    return res
      .status(200)
      .json(new ApiResponse(200, { fileId }, "File is not starred"));
  }

  // 3. Delete the star record
  const { error: deleteError } = await supabase
    .from("stars")
    .delete()
    .eq("id", existingStar.id);

  if (deleteError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to remove file from favorites",
      errorCode: "DB_DELETE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { fileId },
        "File removed from favorites successfully"
      )
    );
});

export {
  searchNodes,
  getRecentFiles,
  getStarredFiles,
  markFileAsStarred,
  removeFileFromStarred,
};
