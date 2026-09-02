package com.graffiti.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graffiti.op.Op;
import com.graffiti.op.OpRequestDTO;
import com.graffiti.op.OpService;
import com.graffiti.presence.PresenceMessageDTO;
import com.graffiti.redis.RedisMessagePublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller handling STOMP WebSocket incoming message mappings.
 *
 * Distinguishes between:
 * 1. Structural Ops (/app/rooms/{slug}/op): Persisted via OpService and broadcast to room subscribers via Redis Pub/Sub.
 * 2. Ephemeral Presence (/app/rooms/{slug}/presence): Direct Redis Pub/Sub broadcast without database persistence (zero disk write overhead).
 */
@Controller
public class RoomMessageController {

    private static final Logger log = LoggerFactory.getLogger(RoomMessageController.class);

    private final RoomRepository roomRepository;
    private final OpService opService;
    private final RedisMessagePublisher redisPublisher;
    private final ObjectMapper objectMapper;

    public RoomMessageController(RoomRepository roomRepository,
                                 OpService opService,
                                 RedisMessagePublisher redisPublisher,
                                 ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.opService = opService;
        this.redisPublisher = redisPublisher;
        this.objectMapper = objectMapper;
    }

    /**
     * Handles structural canvas shape mutations (create, update, delete).
     * Delegates persistence and atomic Lamport timestamp generation to OpService,
     * then broadcasts the op payload to Redis topic room:{slug}:op.
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

        Op op = opService.processAndSaveOp(room.getId(), request);

        try {
            Map<String, Object> broadcastPayload = new HashMap<>();
            broadcastPayload.put("type", "OP");
            broadcastPayload.put("id", op.getId().toString());
            broadcastPayload.put("roomId", room.getId().toString());
            broadcastPayload.put("shapeId", op.getShapeId());
            broadcastPayload.put("opType", op.getOpType().name());
            broadcastPayload.put("payload", op.getPayload());
            broadcastPayload.put("lamportTs", op.getLamportTs());
            broadcastPayload.put("authorId", op.getAuthorId());
            broadcastPayload.put("createdAt", op.getCreatedAt().toString());

            String jsonMessage = objectMapper.writeValueAsString(broadcastPayload);
            redisPublisher.publish("room:" + slug + ":op", jsonMessage);
        } catch (Exception e) {
            log.error("Error serializing op for broadcasting: {}", e.getMessage());
        }
    }

    /**
     * Handles ephemeral user presence events (cursor positions, active element selection, laser trails).
     * Bypasses database persistence entirely and streams directly to Redis topic room:{slug}:presence.
     * Safely handles null payloads without throwing NullPointerException.
     *
     * @param slug Room slug from destination variable
     * @param presence Incoming presence event DTO
     */
    @MessageMapping("/rooms/{slug}/presence")
    public void handlePresence(@DestinationVariable("slug") String slug, PresenceMessageDTO presence) {
        if (presence == null) {
            return;
        }

        try {
            Map<String, Object> broadcastPayload = new HashMap<>();
            broadcastPayload.put("type", "PRESENCE");
            broadcastPayload.put("authorId", (presence.getAuthorId() != null) ? presence.getAuthorId() : "anonymous");
            broadcastPayload.put("presenceType", (presence.getType() != null) ? presence.getType() : "cursor");
            broadcastPayload.put("payload", presence.getPayload());

            String jsonMessage = objectMapper.writeValueAsString(broadcastPayload);
            redisPublisher.publish("room:" + slug + ":presence", jsonMessage);
        } catch (Exception e) {
            log.error("Error serializing presence message for broadcasting: {}", e.getMessage());
        }
    }
}
