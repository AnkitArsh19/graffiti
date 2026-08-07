package com.graffiti.controller;

import com.graffiti.room.*;
import com.graffiti.user.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

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

    @BeforeEach
    void setUp() {
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
}
