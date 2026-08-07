package com.graffiti.op;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA Repository for Op entity.
 * Provides custom query methods to retrieve operations ordered by Lamport timestamp.
 */
public interface OpRepository extends JpaRepository<Op, UUID> {
    List<Op> findByRoomIdOrderByLamportTsAsc(UUID roomId);

    List<Op> findByRoomIdAndLamportTsGreaterThanOrderByLamportTsAsc(UUID roomId, Long lamportTs);

    @Query("SELECT MAX(o.lamportTs) FROM Op o WHERE o.roomId = :roomId")
    Optional<Long> findMaxLamportTsByRoomId(@Param("roomId") UUID roomId);

    long countByRoomIdAndLamportTsGreaterThan(UUID roomId, Long lamportTs);
}
