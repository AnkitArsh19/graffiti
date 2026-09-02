package com.graffiti.op;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service providing database persistence and atomic Lamport timestamp generation for canvas shape operations.
 */
@Service
public class OpService {

    private static final Logger log = LoggerFactory.getLogger(OpService.class);

    private final OpRepository opRepository;
    private final StringRedisTemplate redisTemplate;

    public OpService(OpRepository opRepository, StringRedisTemplate redisTemplate) {
        this.opRepository = opRepository;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Atomically assigns the next monotonic Lamport timestamp for a room and persists the operation.
     * Uses Redis atomic counter (room:{roomId}:lamport) for sub-millisecond, race-free timestamp allocation
     * across cluster nodes, with transparent fallback to PostgreSQL when Redis is unavailable.
     *
     * @param roomId Target room ID
     * @param request The incoming OpRequestDTO payload
     * @return Saved Op entity with assigned Lamport timestamp
     */
    @Transactional
    public Op processAndSaveOp(UUID roomId, OpRequestDTO request) {
        Long nextLamportTs = getNextLamportTs(roomId, request.getLamportTs());
        Op op = new Op(
                roomId,
                request.getShapeId(),
                request.getOpType(),
                request.getPayload(),
                nextLamportTs,
                (request.getAuthorId() != null) ? request.getAuthorId() : "anonymous"
        );
        return opRepository.save(op);
    }

    /**
     * Calculates the next atomic Lamport timestamp using Redis INCR with PostgreSQL fallback.
     *
     * @param roomId Target room ID
     * @param clientLamport Client's reported Lamport timestamp
     * @return Next monotonic Lamport timestamp
     */
    public Long getNextLamportTs(UUID roomId, Long clientLamport) {
        long clientTs = (clientLamport != null) ? clientLamport : 0L;
        String redisKey = "room:" + roomId + ":lamport";

        try {
            if (redisTemplate != null && redisTemplate.opsForValue() != null) {
                // Ensure key exists, initialized from DB max if absent (cold start)
                redisTemplate.opsForValue().setIfAbsent(
                        redisKey,
                        String.valueOf(opRepository.findMaxLamportTsByRoomId(roomId).orElse(0L))
                );

                Long nextVal = redisTemplate.opsForValue().increment(redisKey);
                if (nextVal != null) {
                    if (nextVal <= clientTs) {
                        // Fast-forward Redis counter if client had a higher local Lamport clock
                        long target = clientTs + 1;
                        redisTemplate.opsForValue().set(redisKey, String.valueOf(target));
                        return target;
                    }
                    return nextVal;
                }
            }
        } catch (Exception e) {
            log.warn("Redis unavailable for atomic Lamport increment, using database fallback: {}", e.getMessage());
        }

        // Database fallback for test profile or standalone mode
        Long currentMax = opRepository.findMaxLamportTsByRoomId(roomId).orElse(0L);
        return Math.max(currentMax, clientTs) + 1;
    }

    /**
     * Persists an Op entity directly.
     *
     * @param op Target Op entity
     * @return Saved Op entity
     */
    @Transactional
    public Op saveOp(Op op) {
        return opRepository.save(op);
    }

    /**
     * Fetches all operations for a room executed after a specified Lamport timestamp checkpoint.
     *
     * @param roomId Target room ID
     * @param lamportTs Lamport timestamp threshold
     * @return List of Op entities ordered by Lamport timestamp ascending
     */
    public List<Op> getOpsAfterLamport(UUID roomId, Long lamportTs) {
        return opRepository.findByRoomIdAndLamportTsGreaterThanOrderByLamportTsAsc(roomId, lamportTs);
    }
}
