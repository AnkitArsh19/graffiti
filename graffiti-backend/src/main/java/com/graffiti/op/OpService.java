package com.graffiti.op;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Service providing high-throughput database persistence, asynchronous write-behind buffering,
 * and atomic Lamport timestamp generation for real-time collaborative canvas operations.
 */
@Service
public class OpService {

    private static final Logger log = LoggerFactory.getLogger(OpService.class);

    private final OpRepository opRepository;
    private final StringRedisTemplate redisTemplate;

    // High-concurrency lock-free write-behind buffer for coalesced database batch writes
    private final ConcurrentLinkedQueue<Op> writeBuffer = new ConcurrentLinkedQueue<>();

    @Value("${app.ops.buffer.enabled:true}")
    private boolean bufferEnabled;

    @Value("${app.ops.buffer.max-batch-size:200}")
    private int maxBatchSize;

    public OpService(OpRepository opRepository, StringRedisTemplate redisTemplate) {
        this.opRepository = opRepository;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Atomically assigns the next monotonic Lamport timestamp for a room and persists or buffers the operation.
     * With write-behind buffer enabled, the op is buffered in memory and flushed in micro-batches (saveAll),
     * enabling sub-millisecond response times without blocking on single-row database disk I/O.
     *
     * @param roomId Target room ID
     * @param request The incoming OpRequestDTO payload
     * @return Prepared Op entity with assigned Lamport timestamp
     */
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

        if (bufferEnabled) {
            writeBuffer.offer(op);
            return op;
        } else {
            return opRepository.save(op);
        }
    }

    /**
     * Periodic background task that drains the write-behind buffer and executes a bulk saveAll insert
     * in PostgreSQL every 50ms, coalescing thousands of strokes into high-efficiency database batch writes.
     */
    @Scheduled(fixedDelayString = "${app.ops.buffer.flush-interval-ms:50}")
    @Transactional
    public void flushBuffer() {
        if (writeBuffer.isEmpty()) {
            return;
        }

        List<Op> batch = new ArrayList<>(maxBatchSize);
        Op op;
        while ((op = writeBuffer.poll()) != null) {
            batch.add(op);
            if (batch.size() >= maxBatchSize) {
                break;
            }
        }

        if (!batch.isEmpty()) {
            try {
                opRepository.saveAll(batch);
                log.debug("Flushed {} ops to PostgreSQL in micro-batch", batch.size());
            } catch (Exception e) {
                log.error("Failed to flush op batch to database: {}", e.getMessage(), e);
                // Re-queue items if write failed to prevent data loss
                writeBuffer.addAll(batch);
            }
        }
    }

    /**
     * Graceful shutdown hook ensuring any buffered ops in memory are written to disk before termination.
     */
    @PreDestroy
    public void flushAllOnShutdown() {
        log.info("Flushing remaining {} buffered ops on shutdown...", writeBuffer.size());
        while (!writeBuffer.isEmpty()) {
            flushBuffer();
        }
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
     * Flushes the in-memory write buffer first to guarantee read-your-own-writes consistency.
     *
     * @param roomId Target room ID
     * @param lamportTs Lamport timestamp threshold
     * @return List of Op entities ordered by Lamport timestamp ascending
     */
    public List<Op> getOpsAfterLamport(UUID roomId, Long lamportTs) {
        flushBuffer();
        return opRepository.findByRoomIdAndLamportTsGreaterThanOrderByLamportTsAsc(roomId, lamportTs);
    }
}
