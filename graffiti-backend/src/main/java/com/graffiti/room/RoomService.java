package com.graffiti.room;

import com.graffiti.op.Op;
import com.graffiti.op.OpRepository;
import com.graffiti.op.OpService;
import com.graffiti.roommember.Role;
import com.graffiti.roommember.RoomMember;
import com.graffiti.roommember.RoomMemberRepository;
import com.graffiti.snapshot.Snapshot;
import com.graffiti.snapshot.SnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service encapsulating business logic for whiteboard room management.
 *
 * Handles room creation (anonymous or authenticated), fetching room canvas state
 * (snapshot + incremental ops), and claiming anonymous rooms for registered users.
 */
@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final SnapshotRepository snapshotRepository;
    private final OpService opService;

    public RoomService(RoomRepository roomRepository,
                       RoomMemberRepository roomMemberRepository,
                       SnapshotRepository snapshotRepository,
                       OpService opService) {
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.snapshotRepository = snapshotRepository;
        this.opService = opService;
    }

    /**
     * Creates a new whiteboard room with a random 8-character slug.
     * If created by an authenticated user, assigns ownerId and creates an OWNER RoomMember record.
     *
     * @param authenticatedUserId Optional UUID of logged-in user
     * @return CreateRoomResponse containing room metadata
     */
    @Transactional
    public CreateRoomResponse createRoom(UUID authenticatedUserId) {
        String slug = generateUniqueSlug();
        Room room = new Room(slug, authenticatedUserId);
        roomRepository.save(room);

        if (authenticatedUserId != null) {
            RoomMember member = new RoomMember(room.getId(), authenticatedUserId, Role.OWNER);
            roomMemberRepository.save(member);
        }

        return new CreateRoomResponse(room.getId(), room.getSlug(), room.getOwnerId(), room.getCreatedAt());
    }

    /**
     * Fetches detailed room metadata, including the latest compacted Snapshot state
     * and any un-compacted operations executed after that snapshot.
     *
     * @param slug The unique room slug identifier
     * @return RoomDetailResponse with state JSON and operation history
     */
    public RoomDetailResponse getRoomDetail(String slug) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));

        Snapshot snapshot = snapshotRepository.findTopByRoomIdOrderByUpToLamportTsDesc(room.getId()).orElse(null);
        Long upToLamport = (snapshot != null) ? snapshot.getUpToLamportTs() : -1L;

        // Efficiently fetch ops executed since the latest snapshot, flushing any pending write-behind buffer items
        List<Op> opsSinceSnapshot = opService.getOpsAfterLamport(room.getId(), upToLamport);

        return new RoomDetailResponse(
                room.getId(),
                room.getSlug(),
                room.getOwnerId(),
                room.getCreatedAt(),
                (snapshot != null) ? snapshot.getState() : null,
                upToLamport,
                opsSinceSnapshot
        );
    }

    /**
     * Associates an anonymous room (ownerId == null) with an authenticated user,
     * assigning them as the room OWNER.
     *
     * @param slug Room slug
     * @param authenticatedUserId Authenticated user ID
     * @return Updated CreateRoomResponse metadata
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
     * Incremental catch-up synchronization: fetches only the delta operations executed
     * after a specified Lamport timestamp, flushing any pending write-behind buffer items.
     *
     * @param slug Room unique slug identifier
     * @param since Lamport timestamp threshold
     * @return List of delta operations
     */
    public List<Op> getDeltaOps(String slug, Long since) {
        Room room = roomRepository.findBySlug(slug)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("ROOM_NOT_FOUND", "No room exists for slug '" + slug + "'."));
        return opService.getOpsAfterLamport(room.getId(), (since != null) ? since : -1L);
    }

    /**
     * Generates a collision-free short slug for clean URL routing.
     */
    private String generateUniqueSlug() {
        String slug;
        do {
            slug = UUID.randomUUID().toString().substring(0, 8);
        } while (roomRepository.existsBySlug(slug));
        return slug;
    }
}
