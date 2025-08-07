// src/utils/ApiError.js
class ApiError extends Error {
  constructor({
    statusCode = 500,
    message = "Something went wrong",
    errors = [],
    errorCode = "INTERNAL_ERROR",
    isOperational = true,
    stack = null,
  }) {
    super(message);

    this.name = this.constructor.name;

    // Core properties
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;

    // Meta
    this.errorCode = errorCode;
    this.success = false;
    this.data = null;

    // Debug
    this.isOperational = isOperational;
    this.stack = stack || Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
