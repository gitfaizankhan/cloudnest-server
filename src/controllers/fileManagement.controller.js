import { supabase } from "../utils/supabaseClient.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ============================================================================
   GET /files - List all user files with pagination
============================================================================ */
const listFiles = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // Pagination params
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  // 1. Query DB
  const {
    data: files,
    error,
    count,
  } = await supabase
    .from("nodes")
    .select("id, name, size_bytes, mime_type, created_at, updated_at", {
      count: "exact",
    })
    .eq("owner_id", userId)
    .eq("type", "file")
    .is("deleted_at", null)
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to fetch files",
      errorCode: "DB_QUERY_FAILED",
    });
  }

  // 2. Build response with pagination metadata
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        files,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
      "Files fetched successfully"
    )
  );
});

/* ============================================================================
   GET /folders - List all user folders with pagination
============================================================================ */
const listFolders = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // Pagination params
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  // 1. Query DB
  const {
    data: folders,
    error,
    count,
  } = await supabase
    .from("nodes")
    .select("id, name, parent_id, created_at, updated_at", { count: "exact" })
    .eq("owner_id", userId)
    .eq("type", "folder")
    .is("deleted_at", null)
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to fetch folders",
      errorCode: "DB_QUERY_FAILED",
    });
  }

  // 2. Build response with pagination metadata
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        folders,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
      "Folders fetched successfully"
    )
  );
});

/* ============================================================================
   POST /folders - Create new folder
============================================================================ */
const createFolder = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { name, parent_id = null } = req.body;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!name || name.trim() === "") {
    throw new ApiError({
      statusCode: 422,
      message: "Folder name is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Insert into DB
  const { data, error } = await supabase
    .from("nodes")
    .insert([
      {
        owner_id: userId,
        type: "folder",
        name: name.trim(),
        parent_id: parent_id || null,
      },
    ])
    .select("id, name, parent_id, created_at, updated_at")
    .single();

  if (error) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to create folder",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, { folder: data }, "Folder created successfully")
    );
});

/* ============================================================================
   PUT /files/:id - Update/rename file
============================================================================ */
const renameFile = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { name } = req.body;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!name || name.trim() === "") {
    throw new ApiError({
      statusCode: 422,
      message: "File name is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Check if file exists and belongs to user
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
      message: "You do not have permission to rename this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // Update file name
  const { data: updatedFile, error: updateError } = await supabase
    .from("nodes")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, updated_at")
    .single();

  if (updateError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to update file name",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { file: updatedFile }, "File renamed successfully")
    );
});

/* ============================================================================
   PUT /folders/:id - Update/rename folder
============================================================================ */
const renameFolder = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { name } = req.body;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!name || name.trim() === "") {
    throw new ApiError({
      statusCode: 422,
      message: "Folder name is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Check if folder exists and belongs to user
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
      message: "You do not have permission to rename this folder",
      errorCode: "ACCESS_DENIED",
    });
  }

  // Update folder name
  const { data: updatedFolder, error: updateError } = await supabase
    .from("nodes")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, updated_at")
    .single();

  if (updateError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to update folder name",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { folder: updatedFolder },
        "Folder renamed successfully"
      )
    );
});

/* ============================================================================
   DELETE /files/:id - Soft delete file (move to trash)
============================================================================ */
const softDeleteFile = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Check if file exists
  const { data: file, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type, deleted_at")
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
      message: "You do not have permission to delete this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  if (file.deleted_at) {
    throw new ApiError({
      statusCode: 400,
      message: "File already in trash",
      errorCode: "ALREADY_DELETED",
    });
  }

  // 2. Soft delete (set deleted_at timestamp)
  const { data: deletedFile, error: updateError } = await supabase
    .from("nodes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, deleted_at")
    .single();

  if (updateError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to delete file",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { file: deletedFile },
        "File moved to trash successfully"
      )
    );
});

/* ============================================================================
   DELETE /folders/:id - Soft delete folder (move to trash)
============================================================================ */
const softDeleteFolder = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Check if folder exists
  const { data: folder, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type, deleted_at")
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
      message: "You do not have permission to delete this folder",
      errorCode: "ACCESS_DENIED",
    });
  }

  if (folder.deleted_at) {
    throw new ApiError({
      statusCode: 400,
      message: "Folder already in trash",
      errorCode: "ALREADY_DELETED",
    });
  }

  const deletedAt = new Date().toISOString();

  // 2. Soft delete the folder itself
  const { error: updateFolderError } = await supabase
    .from("nodes")
    .update({ deleted_at: deletedAt })
    .eq("id", id);

  if (updateFolderError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to delete folder",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  // 3. Soft delete all child files/folders (recursive effect)
  const { error: updateChildrenError } = await supabase
    .from("nodes")
    .update({ deleted_at: deletedAt })
    .eq("owner_id", userId)
    .eq("parent_id", id)
    .is("deleted_at", null);

  if (updateChildrenError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to delete child nodes",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { folderId: id, deleted_at: deletedAt },
        "Folder and its contents moved to trash successfully"
      )
    );
});

/* ============================================================================
   POST /files/:id/copy - Create copy of file
============================================================================ */
const copyFile = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { parent_id = null } = req.body;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  // 1. Fetch the file metadata
  const { data: file, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type, name, size_bytes, mime_type, path, parent_id")
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
      message: "You do not have permission to copy this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Insert new file entry (copy)
  const copyName = `${file.name}_copy`;

  const { data: newFile, error: insertError } = await supabase
    .from("nodes")
    .insert([
      {
        owner_id: userId,
        type: "file",
        name: copyName,
        size_bytes: file.size_bytes,
        mime_type: file.mime_type,
        path: file.path, // same S3 path (shared)
        parent_id: parent_id || file.parent_id,
      },
    ])
    .select("id, name, parent_id, created_at")
    .single();

  if (insertError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to copy file",
      errorCode: "DB_INSERT_FAILED",
    });
  }

  return res
    .status(201)
    .json(new ApiResponse(201, { file: newFile }, "File copied successfully"));
});

/* ============================================================================
   POST /files/:id/move - Move file to different folder
============================================================================ */
const moveFile = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { target_folder_id } = req.body;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!target_folder_id) {
    throw new ApiError({
      statusCode: 422,
      message: "Target folder ID is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Check if file exists and belongs to user
  const { data: file, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type, parent_id")
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
      message: "You do not have permission to move this file",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Validate target folder exists & belongs to user
  const { data: folder, error: folderError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", target_folder_id)
    .single();

  if (folderError || !folder) {
    throw new ApiError({
      statusCode: 404,
      message: "Target folder not found",
      errorCode: "FOLDER_NOT_FOUND",
    });
  }

  if (folder.type !== "folder") {
    throw new ApiError({
      statusCode: 400,
      message: "Target node is not a folder",
      errorCode: "INVALID_TARGET",
    });
  }

  if (folder.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not have permission to move files into this folder",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 3. Update file's parent_id (move file)
  const { data: movedFile, error: updateError } = await supabase
    .from("nodes")
    .update({
      parent_id: target_folder_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, parent_id, updated_at")
    .single();

  if (updateError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to move file",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { file: movedFile }, "File moved successfully"));
});

/* ============================================================================
   POST /folders/:id/move - Move folder to different location
============================================================================ */
const moveFolder = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { target_folder_id } = req.body;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!target_folder_id) {
    throw new ApiError({
      statusCode: 422,
      message: "Target folder ID is required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // 1. Check if folder exists and belongs to user
  const { data: folder, error: fetchError } = await supabase
    .from("nodes")
    .select("id, owner_id, type, parent_id")
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
      message: "You do not have permission to move this folder",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 2. Validate target folder exists and belongs to user
  const { data: targetFolder, error: targetError } = await supabase
    .from("nodes")
    .select("id, owner_id, type")
    .eq("id", target_folder_id)
    .single();

  if (targetError || !targetFolder) {
    throw new ApiError({
      statusCode: 404,
      message: "Target folder not found",
      errorCode: "TARGET_FOLDER_NOT_FOUND",
    });
  }

  if (targetFolder.type !== "folder") {
    throw new ApiError({
      statusCode: 400,
      message: "Target node is not a folder",
      errorCode: "INVALID_TARGET",
    });
  }

  if (targetFolder.owner_id !== userId) {
    throw new ApiError({
      statusCode: 403,
      message: "You do not have permission to move folders here",
      errorCode: "ACCESS_DENIED",
    });
  }

  // 3. Prevent circular nesting (folder inside itself or its children)
  if (id === target_folder_id) {
    throw new ApiError({
      statusCode: 400,
      message: "Cannot move a folder into itself",
      errorCode: "INVALID_MOVE",
    });
  }

  // Fetch all children of the folder (basic check)
  const { data: childNodes, error: childError } = await supabase
    .from("nodes")
    .select("id, parent_id")
    .eq("owner_id", userId);

  if (!childError && childNodes) {
    const checkCircular = (folderId, targetId) => {
      for (const node of childNodes) {
        if (node.parent_id === folderId) {
          if (node.id === targetId) return true;
          if (checkCircular(node.id, targetId)) return true;
        }
      }
      return false;
    };

    if (checkCircular(id, target_folder_id)) {
      throw new ApiError({
        statusCode: 400,
        message: "Cannot move a folder inside its own subfolder",
        errorCode: "INVALID_MOVE",
      });
    }
  }

  // 4. Move the folder
  const { data: movedFolder, error: updateError } = await supabase
    .from("nodes")
    .update({
      parent_id: target_folder_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, parent_id, updated_at")
    .single();

  if (updateError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to move folder",
      errorCode: "DB_UPDATE_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { folder: movedFolder }, "Folder moved successfully")
    );
});

/* =========================================================================
   GET /folders/:id/contents - Get all files/folders in a folder
============================================================================ */
const getFolderContents = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError({
      statusCode: 401,
      message: "Unauthorized",
      errorCode: "UNAUTHORIZED",
    });
  }

  let parentId = id;
  if (id === "root" || id === "null") {
    parentId = null; // root-level fetch
  }

  // 1. Validate folder exists (if not root)
  if (parentId) {
    const { data: folder, error: folderError } = await supabase
      .from("nodes")
      .select("id, type, owner_id")
      .eq("id", parentId)
      .single();

    if (folderError || !folder) {
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
        message: "You do not have access to this folder",
        errorCode: "ACCESS_DENIED",
      });
    }
  }

  // 2. Fetch child nodes (files + folders)
  const { data: contents, error: fetchError } = await supabase
    .from("nodes")
    .select("id, name, type, mime_type, size_bytes, created_at, updated_at")
    .eq("owner_id", userId)
    .eq("parent_id", parentId)
    .is("deleted_at", null)
    .order("type", { ascending: true }) // folders first, then files
    .order("name", { ascending: true });

  if (fetchError) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to fetch folder contents",
      errorCode: "DB_FETCH_FAILED",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { folderId: parentId, contents },
        "Folder contents retrieved successfully"
      )
    );
});

export {
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
};
