package com.graffiti.roommember;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service managing membership associations and role querying for rooms.
 */
@Service
public class RoomMemberService {

    private final RoomMemberRepository roomMemberRepository;

    public RoomMemberService(RoomMemberRepository roomMemberRepository) {
        this.roomMemberRepository = roomMemberRepository;
    }

    /**
     * Adds or updates a user's membership role within a room.
     *
     * @param roomId Target room ID
     * @param userId Target user ID
     * @param role Membership role (OWNER, EDITOR, VIEWER)
     * @return Saved RoomMember entity
     */
    @Transactional
    public RoomMember addOrUpdateMember(UUID roomId, UUID userId, Role role) {
        RoomMember member = roomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElse(new RoomMember(roomId, userId, role));
        member.setRole(role);
        return roomMemberRepository.save(member);
    }

    /**
     * Finds a user's specific role in a room.
     *
     * @param roomId Target room ID
     * @param userId Target user ID
     * @return Optional Role enum
     */
    public Optional<Role> getUserRoleInRoom(UUID roomId, UUID userId) {
        return roomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .map(RoomMember::getRole);
    }

    /**
     * Lists all registered members in a room.
     *
     * @param roomId Target room ID
     * @return List of RoomMember entities
     */
    public List<RoomMember> getMembersByRoom(UUID roomId) {
        return roomMemberRepository.findByRoomId(roomId);
    }
}
