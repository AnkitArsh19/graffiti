package com.graffiti.snapshot;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA Repository for Snapshot entity.
 */
public interface SnapshotRepository extends JpaRepository<Snapshot, UUID> {
    Optional<Snapshot> findTopByRoomIdOrderByUpToLamportTsDesc(UUID roomId);
}
