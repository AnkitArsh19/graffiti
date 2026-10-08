package com.graffiti.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA Repository for Room entity.
 */
public interface RoomRepository extends JpaRepository<Room, UUID> {
    Optional<Room> findBySlug(String slug);
    boolean existsBySlug(String slug);

    /**
     * Find all rooms owned by a specific user.
     */
    List<Room> findByOwnerIdOrderByUpdatedAtDesc(UUID ownerId);

    /**
     * Find all rooms where a user is a member (via room_members join).
     */
    @Query("SELECT r FROM Room r JOIN com.graffiti.roommember.RoomMember rm ON r.id = rm.roomId WHERE rm.userId = :userId ORDER BY r.updatedAt DESC")
    List<Room> findRoomsByMembership(@Param("userId") UUID userId);
}
