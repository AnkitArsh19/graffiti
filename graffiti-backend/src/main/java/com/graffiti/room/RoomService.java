package com.graffiti.room;

import com.graffiti.op.Op;
import com.graffiti.op.OpRepository;
import com.graffiti.op.OpService;
import com.graffiti.roommember.Role;
import com.graffiti.roommember.RoomMember;
import com.graffiti.roommember.RoomMemberRepository;
import com.graffiti.snapshot.Snapshot;
import com.graffiti.snapshot.SnapshotRepository;
import com.graffiti.page.Page;
import com.graffiti.page.PageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graffiti.redis.RedisMessagePublisher;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service encapsulating business logic for whiteboard room management.
 */
@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final SnapshotRepository snapshotRepository;
    private final OpService opService;
    private final OpRepository opRepository;
    private final PageRepository pageRepository;
    private final com.graffiti.workspace.WorkspaceRepository workspaceRepository;
    private final com.graffiti.folder.FolderRepository folderRepository;
    private final RedisMessagePublisher redisPublisher;
    private final ObjectMapper objectMapper;

    public RoomService(RoomRepository roomRepository,
                       RoomMemberRepository roomMemberRepository,
                       SnapshotRepository snapshotRepository,
                       OpService opService,
                       OpRepository opRepository,
                       PageRepository pageRepository,
                       com.graffiti.workspace.WorkspaceRepository workspaceRepository,
                       com.graffiti.folder.FolderRepository folderRepository,
                       RedisMessagePublisher redisPublisher,
                       ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.snapshotRepository = snapshotRepository;
        this.opService = opService;
        this.opRepository = opRepository;
        this.pageRepository = pageRepository;
        this.workspaceRepository = workspaceRepository;
        this.folderRepository = folderRepository;
        this.redisPublisher = redisPublisher;
        this.objectMapper = objectMapper;
    }

    private UUID sanitizeWorkspaceId(UUID workspaceId) {
        if (workspaceId == null) return null;
        try {
            return workspaceRepository.existsById(workspaceId) ? workspaceId : null;
        } catch (Exception e) {
            return null;
        }
    }

    private UUID sanitizeFolderId(UUID folderId) {
        if (folderId == null) return null;
        try {
            return folderRepository.existsById(folderId) ? folderId : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Creates a new whiteboard room with a random 8-character slug.
     */
    @Transactional
    public CreateRoomResponse createRoom(UUID authenticatedUserId) {
        return createRoom(authenticatedUserId, null, null, null);
    }

    @Transactional
    public CreateRoomResponse createRoom(UUID authenticatedUserId, String name, UUID workspaceId, UUID folderId) {
        return createRoom(authenticatedUserId, name, workspaceId, folderId, null);
    }

    @Transactional
    public CreateRoomResponse createRoom(UUID authenticatedUserId, String name, UUID workspaceId, UUID folderId, JsonNode snapshotState) {
        String slug = generateUniqueSlug();
        Room room = new Room(slug, authenticatedUserId);
        if (name != null && !name.isBlank()) {
            room.setName(name);
        }
        room.setWorkspaceId(sanitizeWorkspaceId(workspaceId));
        room.setFolderId(sanitizeFolderId(folderId));
        room.setPublic(true);
        roomRepository.save(room);
        pageRepository.save(new Page(room.getId(), "Canvas 1", "grid", 0));

        if (authenticatedUserId != null) {
            RoomMember member = new RoomMember(room.getId(), authenticatedUserId, Role.OWNER);
            roomMemberRepository.save(member);
        }

        if (snapshotState != null && !snapshotState.isNull()) {
            Snapshot snapshot = new Snapshot(room.getId(), snapshotState, 1L);
            snapshotRepository.save(snapshot);
        }

        return new CreateRoomResponse(room.getId(), room.getSlug(), room.getOwnerId(), room.getCreatedAt());
    }

    /**
     * Fetches room details with latest snapshot and delta ops.
     */
    public RoomDetailResponse getRoomDetail(String slug) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));

        Snapshot snapshot = snapshotRepository.findTopByRoomIdOrderByUpToLamportTsDesc(room.getId()).orElse(null);
        Long upToLamport = (snapshot != null) ? snapshot.getUpToLamportTs() : -1L;
        List<Op> opsSinceSnapshot = opService.getOpsAfterLamport(room.getId(), upToLamport);

        return new RoomDetailResponse(
                room.getId(),
                room.getSlug(),
                room.getName(),
                room.getOwnerId(),
                room.getCreatedAt(),
                (snapshot != null) ? snapshot.getState() : null,
                upToLamport,
                opsSinceSnapshot
        );
    }

    /**
     * Lists all rooms where a user is owner or member.
     */
    public List<RoomListResponse> getUserRooms(UUID userId) {
        List<Room> rooms = roomRepository.findRoomsByMembership(userId);
        return rooms.stream().map(room -> {
            List<RoomMember> members = roomMemberRepository.findByRoomId(room.getId());
            String userRole = members.stream()
                    .filter(m -> m.getUserId().equals(userId))
                    .findFirst()
                    .map(m -> m.getRole().name())
                    .orElse("VIEWER");
            RoomListResponse resp = new RoomListResponse(
                    room.getId(), room.getSlug(), room.getName(), room.isPublic(),
                    room.getOwnerId(), room.getCreatedAt(), room.getUpdatedAt(),
                    userRole, members.size()
            );
            resp.setWorkspaceId(room.getWorkspaceId());
            resp.setFolderId(room.getFolderId());
            return resp;
        }).toList();
    }

    /**
     * Updates room properties (name, visibility, workspaceId, folderId).
     */
    @Transactional
    public RoomListResponse updateRoom(String slug, UUID userId, UpdateRoomRequest request) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));

        requireOwner(room, userId);

        if (request.getName() != null) {
            room.setName(request.getName());
        }
        if (request.getIsPublic() != null) {
            room.setPublic(request.getIsPublic());
        }
        if (request.getWorkspaceId() != null) {
            room.setWorkspaceId(sanitizeWorkspaceId(request.getWorkspaceId()));
        }
        if (request.getFolderId() != null) {
            room.setFolderId(sanitizeFolderId(request.getFolderId()));
        }
        room.setUpdatedAt(Instant.now());
        roomRepository.save(room);

        List<RoomMember> members = roomMemberRepository.findByRoomId(room.getId());
        RoomListResponse resp = new RoomListResponse(
                room.getId(), room.getSlug(), room.getName(), room.isPublic(),
                room.getOwnerId(), room.getCreatedAt(), room.getUpdatedAt(),
                "OWNER", members.size()
        );
        resp.setWorkspaceId(room.getWorkspaceId());
        resp.setFolderId(room.getFolderId());
        return resp;
    }

    /**
     * Persists whiteboard content (name, workspace, folder, snapshot state) to the server.
     * Auto-creates the room if it does not exist yet.
     */
    @Transactional
    public void saveRoomContent(String slug, UUID principal, String name, UUID workspaceId, UUID folderId, JsonNode snapshotState) {
        Room room = roomRepository.findBySlug(slug).orElse(null);
        if (room == null) {
            room = new Room(slug, principal);
            if (name != null && !name.isBlank()) {
                room.setName(name);
            }
            room.setWorkspaceId(sanitizeWorkspaceId(workspaceId));
            room.setFolderId(sanitizeFolderId(folderId));
            room.setPublic(true);
            roomRepository.save(room);
            pageRepository.save(new Page(room.getId(), "Canvas 1", "grid", 0));
            if (principal != null) {
                roomMemberRepository.save(new RoomMember(room.getId(), principal, Role.OWNER));
            }
        } else {
            if (room.getOwnerId() == null && principal != null) {
                room.setOwnerId(principal);
                roomMemberRepository.save(new RoomMember(room.getId(), principal, Role.OWNER));
            }

            if (name != null && !name.isBlank()) {
                room.setName(name);
            }
            if (workspaceId != null) {
                room.setWorkspaceId(sanitizeWorkspaceId(workspaceId));
            }
            if (folderId != null) {
                room.setFolderId(sanitizeFolderId(folderId));
            }
            room.setUpdatedAt(Instant.now());
            roomRepository.save(room);
        }

        if (snapshotState != null) {
            Snapshot snapshot = snapshotRepository.findTopByRoomIdOrderByUpToLamportTsDesc(room.getId()).orElse(null);
            long lamport = (snapshot != null) ? snapshot.getUpToLamportTs() + 1 : 1L;
            Snapshot newSnapshot = new Snapshot(room.getId(), snapshotState, lamport);
            snapshotRepository.save(newSnapshot);
        }
    }

    /**
     * Deletes a room and all associated ops, snapshots, and members.
     */
    @Transactional
    public void deleteRoom(String slug, UUID userId) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));

        requireOwner(room, userId);

        roomMemberRepository.deleteAll(roomMemberRepository.findByRoomId(room.getId()));
        opRepository.deleteByRoomId(room.getId());
        snapshotRepository.deleteByRoomId(room.getId());
        pageRepository.deleteByRoomId(room.getId());
        roomRepository.delete(room);
    }

    /**
     * Claims an anonymous room for an authenticated user.
     */
    @Transactional
    public CreateRoomResponse claimRoom(String slug, UUID authenticatedUserId) {
        if (authenticatedUserId == null) {
            throw new IllegalArgumentException("Authentication required to claim a room");
        }

        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));

        if (room.getOwnerId() != null) {
            throw new IllegalStateException("Room is already owned by another user");
        }

        room.setOwnerId(authenticatedUserId);
        roomRepository.save(room);

        RoomMember member = new RoomMember(room.getId(), authenticatedUserId, Role.OWNER);
        roomMemberRepository.save(member);

        return new CreateRoomResponse(room.getId(), room.getSlug(), room.getOwnerId(), room.getCreatedAt());
    }

    /**
     * Handles a user leaving a room. If the leaving user was the owner,
     * ownership is automatically re-assigned to the candidate or next available member.
     */
    @Transactional
    public Map<String, Object> leaveRoom(String slug, UUID userId, String candidateNewOwnerId) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));

        UUID newOwnerId = null;
        boolean wasOwner = (userId != null && room.getOwnerId() != null && room.getOwnerId().equals(userId));

        if (wasOwner) {
            List<RoomMember> members = roomMemberRepository.findByRoomId(room.getId());
            List<RoomMember> remaining = members.stream()
                    .filter(m -> !m.getUserId().equals(userId))
                    .toList();

            if (candidateNewOwnerId != null && !candidateNewOwnerId.isBlank()) {
                try {
                    UUID candId = UUID.fromString(candidateNewOwnerId.trim());
                    if (remaining.stream().anyMatch(m -> m.getUserId().equals(candId))) {
                        newOwnerId = candId;
                    }
                } catch (IllegalArgumentException ignored) {}
            }

            if (newOwnerId == null && !remaining.isEmpty()) {
                // Elect the first available member (prefer EDITOR, else any remaining)
                RoomMember elected = remaining.stream()
                        .filter(m -> m.getRole() == Role.EDITOR)
                        .findFirst()
                        .orElse(remaining.get(0));
                newOwnerId = elected.getUserId();
            }

            if (newOwnerId != null) {
                final UUID electedOwnerId = newOwnerId;
                room.setOwnerId(electedOwnerId);
                RoomMember newOwnerMember = roomMemberRepository.findByRoomIdAndUserId(room.getId(), electedOwnerId)
                        .orElseGet(() -> new RoomMember(room.getId(), electedOwnerId, Role.OWNER));
                newOwnerMember.setRole(Role.OWNER);
                roomMemberRepository.save(newOwnerMember);
            } else {
                room.setOwnerId(null);
            }
            room.setUpdatedAt(Instant.now());
            roomRepository.save(room);
        }

        if (userId != null) {
            roomMemberRepository.deleteByRoomIdAndUserId(room.getId(), userId);
        }

        // Broadcast presence notifications to collaborators
        try {
            if (wasOwner) {
                Map<String, Object> ownerEvent = Map.of(
                        "type", "PRESENCE",
                        "presenceType", "OWNER_CHANGED",
                        "payload", Map.of(
                                "newOwnerId", (newOwnerId != null) ? newOwnerId.toString() : "",
                                "previousOwnerId", (userId != null) ? userId.toString() : ""
                        )
                );
                redisPublisher.publish("room:" + slug + ":presence", objectMapper.writeValueAsString(ownerEvent));
            }

            Map<String, Object> leaveEvent = Map.of(
                    "type", "PRESENCE",
                    "presenceType", "USER_LEFT",
                    "authorId", (userId != null) ? userId.toString() : "anonymous",
                    "payload", Map.of("reason", "left")
            );
            redisPublisher.publish("room:" + slug + ":presence", objectMapper.writeValueAsString(leaveEvent));
        } catch (Exception ignored) {}

        Map<String, Object> res = new HashMap<>();
        res.put("status", "left");
        res.put("slug", slug);
        res.put("wasOwner", wasOwner);
        if (newOwnerId != null) {
            res.put("newOwnerId", newOwnerId.toString());
        }
        return res;
    }

    /**
     * Gets members of a room.
     */
    public List<RoomMember> getRoomMembers(String slug) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));
        return roomMemberRepository.findByRoomId(room.getId());
    }

    /**
     * Incremental catch-up: fetches delta ops since a Lamport timestamp.
     */
    public List<Op> getDeltaOps(String slug, Long since) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));
        return opService.getOpsAfterLamport(room.getId(), (since != null) ? since : -1L);
    }

    /**
     * Returns the Room entity by slug.
     */
    public Room getRoomBySlug(String slug) {
        return roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));
    }

    /** Ensures a user can mutate a room. Anyone can edit public rooms. */
    public Room requireEditor(String slug, UUID userId) {
        Room room = getRoomBySlug(slug);
        if (room.isPublic()) return room;
        if (userId == null) throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        Role role = roomMemberRepository.findByRoomIdAndUserId(room.getId(), userId).map(RoomMember::getRole)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Not a room member"));
        if (role == Role.VIEWER) throw new org.springframework.security.access.AccessDeniedException("Viewer access is read-only");
        return room;
    }

    /** Ensures a user owns a room before modifying settings or membership. */
    public Room requireOwner(String slug, UUID userId) {
        Room room = getRoomBySlug(slug);
        requireOwner(room, userId);
        return room;
    }

    private void requireOwner(Room room, UUID userId) {
        if (userId == null || room.getOwnerId() == null || !room.getOwnerId().equals(userId)) {
            throw new org.springframework.security.access.AccessDeniedException("Only the room owner can perform this action");
        }
    }

    private String generateUniqueSlug() {
        String slug;
        do {
            slug = UUID.randomUUID().toString().substring(0, 8);
        } while (roomRepository.existsBySlug(slug));
        return slug;
    }
}

