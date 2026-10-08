package com.graffiti.room;

import com.graffiti.roommember.Role;
import com.graffiti.roommember.RoomMember;
import com.graffiti.roommember.RoomMemberService;
import com.graffiti.user.UserRepository;
import com.graffiti.user.User;
import com.graffiti.page.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST Controller exposing room management endpoints.
 */
@RestController
@RequestMapping("/rooms")
public class RoomController {

    private final RoomService roomService;
    private final RoomMemberService roomMemberService;
    private final UserRepository userRepository;
    private final PageService pageService;
    private final com.graffiti.email.EmailService emailService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public RoomController(RoomService roomService,
                          RoomMemberService roomMemberService,
                          UserRepository userRepository,
                          PageService pageService,
                          com.graffiti.email.EmailService emailService,
                          com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.roomService = roomService;
        this.roomMemberService = roomMemberService;
        this.userRepository = userRepository;
        this.pageService = pageService;
        this.emailService = emailService;
        this.objectMapper = objectMapper;
    }

    public record CreateRoomRequest(String name, String workspaceId, String folderId, Object snapshotState) {}
    public record SaveRoomContentRequest(String name, String workspaceId, String folderId, Object snapshotState) {}

    private UUID parseUUID(String str) {
        if (str == null || str.isBlank()) return null;
        try {
            return UUID.fromString(str.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Creates a new whiteboard room.
     */
    @PostMapping
    public ResponseEntity<CreateRoomResponse> createRoom(
            @AuthenticationPrincipal UUID principal,
            @RequestBody(required = false) CreateRoomRequest request) {
        com.fasterxml.jackson.databind.JsonNode node = null;
        if (request != null && request.snapshotState() != null) {
            if (request.snapshotState() instanceof com.fasterxml.jackson.databind.JsonNode jn) {
                node = jn;
            } else {
                try {
                    String json = objectMapper.writeValueAsString(request.snapshotState());
                    node = objectMapper.readTree(json);
                } catch (Exception e) {
                    node = objectMapper.valueToTree(request.snapshotState());
                }
            }
        }
        CreateRoomResponse response = (request != null)
                ? roomService.createRoom(principal, request.name(), parseUUID(request.workspaceId()), parseUUID(request.folderId()), node)
                : roomService.createRoom(principal);
        return ResponseEntity.ok(response);
    }

    public ResponseEntity<CreateRoomResponse> createRoom(UUID principal) {
        return createRoom(principal, null);
    }

    /**
     * Saves whiteboard full content and metadata directly to server.
     */
    @PutMapping("/{slug}/content")
    public ResponseEntity<Map<String, Object>> saveRoomContent(
            @PathVariable("slug") String slug,
            @AuthenticationPrincipal UUID principal,
            @RequestBody SaveRoomContentRequest req) {
        com.fasterxml.jackson.databind.JsonNode node = null;
        if (req.snapshotState() != null) {
            if (req.snapshotState() instanceof com.fasterxml.jackson.databind.JsonNode jn) {
                node = jn;
            } else {
                try {
                    String json = objectMapper.writeValueAsString(req.snapshotState());
                    node = objectMapper.readTree(json);
                } catch (Exception e) {
                    node = objectMapper.valueToTree(req.snapshotState());
                }
            }
        }
        roomService.saveRoomContent(slug, principal, req.name(), parseUUID(req.workspaceId()), parseUUID(req.folderId()), node);
        return ResponseEntity.ok(Map.of("status", "saved", "slug", slug));
    }

    /**
     * Retrieves full room details with snapshot and ops.
     */
    @GetMapping("/{slug}")
    public ResponseEntity<RoomDetailResponse> getRoom(@PathVariable("slug") String slug) {
        RoomDetailResponse response = roomService.getRoomDetail(slug);
        return ResponseEntity.ok(response);
    }

    /**
     * Lists all rooms the authenticated user owns or is a member of.
     */
    @GetMapping("/mine")
    public ResponseEntity<List<RoomListResponse>> getMyRooms(@AuthenticationPrincipal UUID principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        List<RoomListResponse> rooms = roomService.getUserRooms(principal);
        return ResponseEntity.ok(rooms);
    }

    /**
     * Updates room properties (name, visibility).
     */
    @PatchMapping("/{slug}")
    public ResponseEntity<RoomListResponse> updateRoom(
            @PathVariable("slug") String slug,
            @AuthenticationPrincipal UUID principal,
            @RequestBody UpdateRoomRequest request) {
        RoomListResponse response = roomService.updateRoom(slug, principal, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Deletes a room (owner only).
     */
    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable("slug") String slug,
            @AuthenticationPrincipal UUID principal) {
        roomService.deleteRoom(slug, principal);
        return ResponseEntity.noContent().build();
    }

    /**
     * Claims ownership of an unclaimed room.
     */
    @PostMapping("/{slug}/claim")
    public ResponseEntity<CreateRoomResponse> claimRoom(
            @PathVariable("slug") String slug,
            @AuthenticationPrincipal UUID principal) {
        CreateRoomResponse response = roomService.claimRoom(slug, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Lists members of a room.
     */
    @GetMapping("/{slug}/members")
    public ResponseEntity<List<Map<String, Object>>> getRoomMembers(@PathVariable("slug") String slug) {
        List<RoomMember> members = roomService.getRoomMembers(slug);
        List<Map<String, Object>> result = members.stream().map(m -> {
            String email = userRepository.findById(m.getUserId())
                    .map(User::getEmail).orElse("unknown");
            String name = userRepository.findById(m.getUserId())
                    .map(User::getName).orElse(null);
            return Map.<String, Object>of(
                    "userId", m.getUserId().toString(),
                    "role", m.getRole().name(),
                    "email", email,
                    "name", (name != null) ? name : email
            );
        }).toList();
        return ResponseEntity.ok(result);
    }

    /**
     * Adds a member to a room by email.
     */
    @PostMapping("/{slug}/members")
    public ResponseEntity<?> addMember(
            @PathVariable("slug") String slug,
            @AuthenticationPrincipal UUID principal,
            @RequestBody Map<String, String> body) {
        String email = body.get("email");
        String roleStr = body.getOrDefault("role", "EDITOR");

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        Room room = roomService.requireOwner(slug, principal);
        Role role;
        try { role = Role.valueOf(roleStr.toUpperCase()); }
        catch (IllegalArgumentException ignored) { return ResponseEntity.badRequest().body(Map.of("error", "Role must be EDITOR or VIEWER")); }
        if (role == Role.OWNER) return ResponseEntity.badRequest().body(Map.of("error", "Owner role cannot be invited"));

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = new User(email, UUID.randomUUID().toString());
            newUser.setName(email.split("@")[0]);
            return userRepository.save(newUser);
        });

        RoomMember member = roomMemberService.addOrUpdateMember(room.getId(), user.getId(), role);

        String inviterNameOrEmail = "A teammate";
        if (principal != null) {
            User inviter = userRepository.findById(principal).orElse(null);
            if (inviter != null) {
                inviterNameOrEmail = (inviter.getName() != null && !inviter.getName().isBlank())
                        ? inviter.getName()
                        : inviter.getEmail();
            }
        }

        emailService.sendRoomInviteEmail(email, inviterNameOrEmail, room.getName(), slug, role.name());

        return ResponseEntity.ok(Map.of(
                "userId", member.getUserId().toString(),
                "role", member.getRole().name(),
                "email", email,
                "message", "Invitation sent to " + email
        ));
    }

    /**
     * Removes a member from a room.
     */
    @DeleteMapping("/{slug}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable("slug") String slug,
            @PathVariable("userId") UUID userId,
            @AuthenticationPrincipal UUID principal) {
        Room room = roomService.requireOwner(slug, principal);
        if (userId.equals(room.getOwnerId())) return ResponseEntity.badRequest().build();
        roomMemberService.removeMember(room.getId(), userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Leaves a room. If user was owner, automatically reassigns owner to next active member.
     */
    @PostMapping("/{slug}/leave")
    public ResponseEntity<Map<String, Object>> leaveRoom(
            @PathVariable("slug") String slug,
            @AuthenticationPrincipal UUID principal,
            @RequestBody(required = false) Map<String, String> body) {
        String candidateOwnerId = (body != null) ? body.get("candidateNewOwnerId") : null;
        Map<String, Object> result = roomService.leaveRoom(slug, principal, candidateOwnerId);
        return ResponseEntity.ok(result);
    }

    /**
     * Incremental delta sync endpoint.
     */
    @GetMapping("/{slug}/sync")
    public ResponseEntity<List<com.graffiti.op.Op>> syncDeltaOps(
            @PathVariable("slug") String slug,
            @RequestParam(value = "since", defaultValue = "-1") Long since) {
        List<com.graffiti.op.Op> deltaOps = roomService.getDeltaOps(slug, since);
        return ResponseEntity.ok(deltaOps);
    }

    @GetMapping("/{slug}/pages")
    public ResponseEntity<List<Page>> listPages(@PathVariable String slug) { return ResponseEntity.ok(pageService.list(slug)); }

    @PostMapping("/{slug}/pages")
    public ResponseEntity<Page> createPage(@PathVariable String slug, @AuthenticationPrincipal UUID principal, @RequestBody CreatePageRequest request) {
        return ResponseEntity.ok(pageService.create(slug, principal, request));
    }

    @PatchMapping("/{slug}/pages/{pageId}")
    public ResponseEntity<Page> updatePage(@PathVariable String slug, @PathVariable UUID pageId, @AuthenticationPrincipal UUID principal, @RequestBody UpdatePageRequest request) {
        return ResponseEntity.ok(pageService.update(slug, pageId, principal, request));
    }

    @DeleteMapping("/{slug}/pages/{pageId}")
    public ResponseEntity<Void> deletePage(@PathVariable String slug, @PathVariable UUID pageId, @AuthenticationPrincipal UUID principal) {
        pageService.delete(slug, pageId, principal); return ResponseEntity.noContent().build();
    }
}
