package com.graffiti.roommember;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA Repository for RoomMember entity.
 */
public interface RoomMemberRepository extends JpaRepository<RoomMember, UUID> {
    Optional<RoomMember> findByRoomIdAndUserId(UUID roomId, UUID userId);
    List<RoomMember> findByRoomId(UUID roomId);
    List<RoomMember> findByUserId(UUID userId);
    void deleteByRoomIdAndUserId(UUID roomId, UUID userId);
}
