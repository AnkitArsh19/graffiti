package com.graffiti.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graffiti.op.Op;
import com.graffiti.op.OpRepository;
import com.graffiti.op.OpRequestDTO;
import com.graffiti.presence.PresenceMessageDTO;
import com.graffiti.redis.RedisMessagePublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Controller handling STOMP WebSocket incoming message mappings.
 *
 * Distinguishes between:
 * 1. Structural Ops (/app/rooms/{slug}/op): Persisted to PostgreSQL database and broadcast to room subscribers via Redis Pub/Sub.
 * 2. Ephemeral Presence (/app/rooms/{slug}/presence): Direct Redis Pub/Sub broadcast without database persistence (zero disk write overhead).
 */
@Controller
public class RoomMessageController {

    private static final Logger log = LoggerFactory.getLogger(RoomMessageController.class);

    private final RoomRepository roomRepository;
    private final OpRepository opRepository;
    private final RedisMessagePublisher redisPublisher;
    private final ObjectMapper objectMapper;

    public RoomMessageController(RoomRepository roomRepository,
                                 OpRepository opRepository,
                                 RedisMessagePublisher redisPublisher,
                                 ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.opRepository = opRepository;
        this.redisPublisher = redisPublisher;
        this.objectMapper = objectMapper;
    }

    /**
     * Handles structural canvas shape mutations (create, update, delete).
     * Atomically assigns the next Lamport timestamp, persists the Op entity in PostgreSQL,
     * and broadcasts the op payload to Redis topic room:{slug}:op.
     *
     * @param slug Room slug from destination variable
     * @param request Incoming OpRequestDTO containing shape ID, op type, and payload JSON
     */
    @MessageMapping("/rooms/{slug}/op")
    public void handleOp(@DestinationVariable("slug") String slug, OpRequestDTO request) {
        Room room = roomRepository.findBySlug(slug).orElse(null);
        if (room == null) {
            log.warn("Received op for non-existent room slug: {}", slug);
            return;
        }

        // Calculate next Lamport timestamp based on current max in DB vs client's timestamp
        Long currentMaxLamport = opRepository.findMaxLamportTsByRoomId(room.getId()).orElse(0L);
        Long clientLamport = (request.getLamportTs() != null) ? request.getLamportTs() : 0L;
        Long nextLamportTs = Math.max(currentMaxLamport, clientLamport) + 1;

        Op op = new Op(
                room.getId(),
                request.getShapeId(),
                request.getOpType(),
                request.getPayload(),
                nextLamportTs,
                (request.getAuthorId() != null) ? request.getAuthorId() : "anonymous"
        );
        opRepository.save(op);

        try {
            Map<String, Object> broadcastPayload = Map.of(
                    "type", "OP",
                    "id", op.getId().toString(),
                    "roomId", room.getId().toString(),
                    "shapeId", op.getShapeId(),
                    "opType", op.getOpType().name(),
                    "payload", op.getPayload(),
                    "lamportTs", op.getLamportTs(),
                    "authorId", op.getAuthorId(),
                    "createdAt", op.getCreatedAt().toString()
            );
            String jsonMessage = objectMapper.writeValueAsString(broadcastPayload);
            redisPublisher.publish("room:" + slug + ":op", jsonMessage);
        } catch (Exception e) {
            log.error("Error serializing op for broadcasting: {}", e.getMessage());
        }
    }

    /**
     * Handles ephemeral user presence events (cursor positions, active element selection, laser trails).
     * Bypasses database persistence entirely and streams directly to Redis topic room:{slug}:presence.
     *
     * @param slug Room slug from destination variable
     * @param presence Incoming presence event DTO
     */
    @MessageMapping("/rooms/{slug}/presence")
    public void handlePresence(@DestinationVariable("slug") String slug, PresenceMessageDTO presence) {
        try {
            Map<String, Object> broadcastPayload = Map.of(
                    "type", "PRESENCE",
                    "authorId", (presence.getAuthorId() != null) ? presence.getAuthorId() : "anonymous",
                    "presenceType", (presence.getType() != null) ? presence.getType() : "cursor",
                    "payload", presence.getPayload()
            );
            String jsonMessage = objectMapper.writeValueAsString(broadcastPayload);
            redisPublisher.publish("room:" + slug + ":presence", jsonMessage);
        } catch (Exception e) {
            log.error("Error serializing presence message for broadcasting: {}", e.getMessage());
        }
    }
}
