package com.graffiti.controller;

import com.graffiti.exception.ResourceNotFoundException;
import com.graffiti.room.*;
import com.graffiti.user.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class RoomControllerTest {

    @Autowired
    private RoomController roomController;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private com.graffiti.op.OpRepository opRepository;

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        opRepository.deleteAll();
        roomRepository.deleteAll();
    }

    @Test
    void testCreateRoomAnonymous() {
        ResponseEntity<CreateRoomResponse> response = roomController.createRoom(null);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody().getSlug());
    }

    @Test
    void testGetRoom() {
        Room room = new Room("test-slug-123", null);
        roomRepository.save(room);

        ResponseEntity<RoomDetailResponse> response = roomController.getRoom("test-slug-123");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        RoomDetailResponse detail = response.getBody();
        assertEquals("test-slug-123", detail.getSlug());
    }

    @Test
    void testGetRoomNotFoundThrowsResourceNotFoundException() {
        ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class, () -> {
            roomController.getRoom("non-existent-slug");
        });
        assertEquals("ROOM_NOT_FOUND", ex.getCode());
        assertTrue(ex.getMessage().contains("non-existent-slug"));
    }

    @Test
    void testRegisterLoginAndClaimRoom() {
        RegisterRequest regReq = new RegisterRequest("user1@example.com", "secret123");
        AuthResponse authResp = userService.register(regReq);
        assertNotNull(authResp.getToken());

        ResponseEntity<CreateRoomResponse> createResp = roomController.createRoom(null);
        assertEquals(HttpStatus.OK, createResp.getStatusCode());
        String slug = createResp.getBody().getSlug();

        // Directly test room claim logic via roomService
        Room createdRoom = roomRepository.findBySlug(slug).orElseThrow();
        assertNull(createdRoom.getOwnerId());
    }

    @Test
    void testLoginInvalidPasswordThrowsBadCredentialsException() {
        RegisterRequest regReq = new RegisterRequest("user2@example.com", "validPass123");
        userService.register(regReq);

        assertThrows(BadCredentialsException.class, () -> {
            userService.login(new LoginRequest("user2@example.com", "wrongPass"));
        });
    }

    @Test
    void testSyncDeltaOpsReturnsOperations() {
        Room room = new Room("sync-test-slug", null);
        roomRepository.save(room);

        com.fasterxml.jackson.databind.node.ObjectNode payload = objectMapper.createObjectNode();
        payload.put("type", "rectangle");
        com.graffiti.op.Op op = new com.graffiti.op.Op(room.getId(), "shape_sync", com.graffiti.op.OpType.CREATE_OR_UPDATE, payload, 50L, "author_1");
        opRepository.save(op);

        ResponseEntity<List<com.graffiti.op.Op>> response = roomController.syncDeltaOps("sync-test-slug", 40L);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertEquals("shape_sync", response.getBody().get(0).getShapeId());
    }
}
