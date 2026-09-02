package com.graffiti.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * Standardized API Error Response DTO returned by GlobalExceptionHandler.
 * Conforms to Project Specification §6.1.1 envelope schema:
 * {
 *   "error": {
 *     "code": "ROOM_NOT_FOUND",
 *     "message": "...",
 *     "status": 404,
 *     "timestamp": "..."
 *   }
 * }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private ErrorDetail error;
    private String path;

    public ErrorResponse() {
    }

    public ErrorResponse(int status, String code, String message, String path) {
        this.error = new ErrorDetail(code, message, status, Instant.now());
        this.path = path;
    }

    public ErrorDetail getError() {
        return error;
    }

    public void setError(ErrorDetail error) {
        this.error = error;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    // Convenience delegates for backwards compatibility
    public int getStatus() {
        return (error != null) ? error.getStatus() : 0;
    }

    public String getMessage() {
        return (error != null) ? error.getMessage() : null;
    }

    public String getCode() {
        return (error != null) ? error.getCode() : null;
    }

    public Instant getTimestamp() {
        return (error != null) ? error.getTimestamp() : null;
    }

    public static class ErrorDetail {
        private String code;
        private String message;
        private int status;
        private Instant timestamp;

        public ErrorDetail() {
            this.timestamp = Instant.now();
        }

        public ErrorDetail(String code, String message, int status, Instant timestamp) {
            this.code = code;
            this.message = message;
            this.status = status;
            this.timestamp = timestamp;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public int getStatus() {
            return status;
        }

        public void setStatus(int status) {
            this.status = status;
        }

        public Instant getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(Instant timestamp) {
            this.timestamp = timestamp;
        }
    }
}
