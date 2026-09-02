package com.graffiti.room;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST Controller exposing room management endpoints.
 *
 * Endpoints:
 * - POST /rooms: Create a new anonymous or owned whiteboard room.
 * - GET /rooms/{slug}: Fetch room canvas details (latest snapshot + incremental ops).
 * - POST /rooms/{slug}/claim: Claim ownership of an unowned room.
 */
@RestController
@RequestMapping("/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    /**
     * Creates a new whiteboard room.
     *
     * @param principal Principal user ID if logged in (null for anonymous users)
     * @return ResponseEntity containing CreateRoomResponse DTO
     */
    @PostMapping
    public ResponseEntity<CreateRoomResponse> createRoom(@AuthenticationPrincipal UUID principal) {
        CreateRoomResponse response = roomService.createRoom(principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieves full room details, including latest snapshot and operations executed since snapshot.
     *
     * @param slug Short unique room identifier
     * @return ResponseEntity containing RoomDetailResponse DTO
     */
    @GetMapping("/{slug}")
    public ResponseEntity<RoomDetailResponse> getRoom(@PathVariable("slug") String slug) {
        RoomDetailResponse response = roomService.getRoomDetail(slug);
        return ResponseEntity.ok(response);
    }

    /**
     * Allows an authenticated user to claim ownership of an anonymous/unclaimed room.
     *
     * @param slug Short unique room identifier
     * @param principal Authenticated user ID
     * @return ResponseEntity containing updated CreateRoomResponse DTO
     */
    @PostMapping("/{slug}/claim")
    public ResponseEntity<CreateRoomResponse> claimRoom(@PathVariable("slug") String slug,
                                                        @AuthenticationPrincipal UUID principal) {
        CreateRoomResponse response = roomService.claimRoom(slug, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Incremental catch-up synchronization endpoint (Google Docs / Figma fast reconnect strategy).
     * Clients recovering from temporary network drops or sleep mode fetch only the missing operations
     * executed after their last acknowledged Lamport timestamp without reloading the entire room.
     *
     * @param slug Short unique room identifier
     * @param since Optional Lamport timestamp threshold (defaults to -1L)
     * @return List of delta operations since the specified timestamp
     */
    @GetMapping("/{slug}/sync")
    public ResponseEntity<java.util.List<com.graffiti.op.Op>> syncDeltaOps(@PathVariable("slug") String slug,
                                                                          @RequestParam(value = "since", defaultValue = "-1") Long since) {
        java.util.List<com.graffiti.op.Op> deltaOps = roomService.getDeltaOps(slug, since);
        return ResponseEntity.ok(deltaOps);
    }
}
