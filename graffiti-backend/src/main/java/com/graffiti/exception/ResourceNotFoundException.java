package com.graffiti.exception;

/**
 * Exception thrown when a requested resource (e.g. room, user, page) cannot be found.
 * Maps to HTTP 404 Not Found in GlobalExceptionHandler.
 */
public class ResourceNotFoundException extends RuntimeException {

    private final String code;

    public ResourceNotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    public ResourceNotFoundException(String message) {
        super(message);
        this.code = "RESOURCE_NOT_FOUND";
    }

    public String getCode() {
        return code;
    }
}
