package com.graffiti.exception;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;
    private MockHttpServletRequest request;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
        request = new MockHttpServletRequest();
        request.setRequestURI("/rooms/test-slug");
    }

    @Test
    void testHandleResourceNotFoundException() {
        ResourceNotFoundException ex = new ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug 'test-slug'.");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleResourceNotFoundException(ex, request);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals(404, response.getBody().getStatus());
        assertEquals("ROOM_NOT_FOUND", response.getBody().getCode());
        assertEquals("No room exists for slug 'test-slug'.", response.getBody().getMessage());
        assertNotNull(response.getBody().getError());
        assertEquals(404, response.getBody().getError().getStatus());
        assertEquals("ROOM_NOT_FOUND", response.getBody().getError().getCode());
    }

    @Test
    void testHandleIllegalArgumentException() {
        IllegalArgumentException ex = new IllegalArgumentException("Invalid parameter");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIllegalArgumentException(ex, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(400, response.getBody().getStatus());
        assertEquals("BAD_REQUEST", response.getBody().getCode());
        assertEquals("Invalid parameter", response.getBody().getMessage());
        assertEquals("/rooms/test-slug", response.getBody().getPath());
    }

    @Test
    void testHandleIllegalStateException() {
        IllegalStateException ex = new IllegalStateException("Room already claimed");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIllegalStateException(ex, request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(409, response.getBody().getStatus());
        assertEquals("ROOM_ALREADY_CLAIMED", response.getBody().getCode());
        assertEquals("Room already claimed", response.getBody().getMessage());
    }

    @Test
    void testHandleGenericException() {
        Exception ex = new Exception("Database timeout");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleGenericException(ex, request);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(500, response.getBody().getStatus());
        assertEquals("INTERNAL_ERROR", response.getBody().getCode());
        assertEquals("An unexpected internal server error occurred.", response.getBody().getMessage());
    }
}
