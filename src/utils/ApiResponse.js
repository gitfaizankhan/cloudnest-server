// Create a standardized API response.
class ApiResponse {
  constructor(statusCode, data = null, message = "Success", success = null) {
    this.statusCode = statusCode;
    this.success = success ?? statusCode < 400;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    const { statusCode, success, message, data, timestamp } = this;
    return { statusCode, success, message, data, timestamp };
  }
}

export default ApiResponse;
