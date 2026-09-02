package com.graffiti.snapshot;

import com.fasterxml.jackson.databind.JsonNode;
import com.graffiti.crdt.CrdtMergeService;
import com.graffiti.op.Op;
import com.graffiti.op.OpRepository;
import com.graffiti.room.Room;
import com.graffiti.room.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Service managing snapshot compaction for whiteboard rooms.
 *
 * Compaction prevents the operation log table from growing infinitely by periodically
 * merging un-compacted operations into a consolidated JSONB snapshot.
 *
 * Distributed Safety:
 * Uses a Redis SET NX PX distributed lock (lock:compact:{roomId}) to ensure that only
 * one backend node executes snapshot compaction for a specific room at any given time.
 */
@Service
public class CompactionService {

    private static final Logger log = LoggerFactory.getLogger(CompactionService.class);

    private final RoomRepository roomRepository;
    private final SnapshotRepository snapshotRepository;
    private final OpRepository opRepository;
    private final CrdtMergeService crdtMergeService;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.compaction.op-threshold:50}")
    private long opThreshold;

    @Value("${app.compaction.redis-lock-ttl-ms:30000}")
    private long lockTtlMs;

    public CompactionService(RoomRepository roomRepository,
                             SnapshotRepository snapshotRepository,
                             OpRepository opRepository,
                             CrdtMergeService crdtMergeService,
                             StringRedisTemplate redisTemplate) {
        this.roomRepository = roomRepository;
        this.snapshotRepository = snapshotRepository;
        this.opRepository = opRepository;
        this.crdtMergeService = crdtMergeService;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Scans all rooms in the system and triggers snapshot compaction if necessary.
     */
    public void compactAllRoomsNeedingCompaction() {
        List<Room> rooms = roomRepository.findAll();
        for (Room room : rooms) {
            try {
                compactRoomIfNecessary(room.getId());
            } catch (Exception e) {
                log.error("Error checking or compacting room {}: {}", room.getId(), e.getMessage());
            }
        }
    }

    /**
     * Checks if a room's op log count since the last snapshot exceeds the threshold N (e.g. 50 ops).
     * If threshold exceeded, acquires a Redis distributed lock, merges the operations using CrdtMergeService,
     * saves a new Snapshot entity, and releases the lock.
     *
     * @param roomId Target room ID
     * @return true if compaction occurred, false otherwise
     */
    @Transactional
    public boolean compactRoomIfNecessary(UUID roomId) {
        Snapshot latestSnapshot = snapshotRepository.findTopByRoomIdOrderByUpToLamportTsDesc(roomId).orElse(null);
        Long upToLamport = (latestSnapshot != null) ? latestSnapshot.getUpToLamportTs() : -1L;

        long opsCount = opRepository.countByRoomIdAndLamportTsGreaterThan(roomId, upToLamport);
        if (opsCount < opThreshold) {
            return false;
        }

        String lockKey = "lock:compact:" + roomId;
        String lockValue = UUID.randomUUID().toString();
        Boolean acquired = false;
        try {
            // Redis distributed lock: SET key value NX PX timeout
            acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, lockValue, Duration.ofMillis(lockTtlMs));
        } catch (Exception e) {
            log.warn("Redis unavailable for distributed lock check, proceeding with single-instance fallback: {}", e.getMessage());
            acquired = true;
        }

        if (Boolean.TRUE.equals(acquired)) {
            try {
                log.info("Starting snapshot compaction for room {} ({} ops since last snapshot)", roomId, opsCount);
                List<Op> newOps = opRepository.findByRoomIdAndLamportTsGreaterThanOrderByLamportTsAsc(roomId, upToLamport);
                if (newOps.isEmpty()) {
                    return false;
                }

                JsonNode baseState = (latestSnapshot != null) ? latestSnapshot.getState() : null;
                JsonNode newCompactedState = crdtMergeService.mergeOpsOnSnapshot(baseState, newOps);

                Long maxLamportTs = newOps.stream()
                        .mapToLong(Op::getLamportTs)
                        .max()
                        .orElse(upToLamport);

                Snapshot newSnapshot = new Snapshot(roomId, newCompactedState, maxLamportTs);
                snapshotRepository.save(newSnapshot);

                try {
                    redisTemplate.opsForValue().set("cache:snapshot:" + roomId, newCompactedState.toString(), Duration.ofHours(1));
                } catch (Exception e) {
                    log.debug("Redis unavailable to cache snapshot for room {}: {}", roomId, e.getMessage());
                }

                log.info("Successfully compacted room {} into snapshot with upToLamportTs {}", roomId, maxLamportTs);
                return true;
            } finally {
                // Safely release Redis lock only if current lock value matches
                try {
                    String currentLockVal = redisTemplate.opsForValue().get(lockKey);
                    if (lockValue.equals(currentLockVal)) {
                        redisTemplate.delete(lockKey);
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return false;
    }
}
