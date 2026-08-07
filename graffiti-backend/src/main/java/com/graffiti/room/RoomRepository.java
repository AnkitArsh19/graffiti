package com.graffiti.room;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA Repository for Room entity.
 * Provides custom query methods to search and verify rooms by slug string.
 */
public interface RoomRepository extends JpaRepository<Room, UUID> {
    Optional<Room> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
