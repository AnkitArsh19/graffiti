package com.graffiti.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graffiti.op.Op;
import com.graffiti.op.OpRequestDTO;
import com.graffiti.op.OpService;
import com.graffiti.presence.PresenceMessageDTO;
import com.graffiti.redis.RedisMessagePublisher;
import com.graffiti.ai.AiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;
import java.security.Principal;
import java.util.concurrent.CompletableFuture;

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
    private final RoomService roomService;
    private final AiService aiService;

    public RoomMessageController(RoomRepository roomRepository,
                                 OpService opService,
                                 RedisMessagePublisher redisPublisher,
                                 ObjectMapper objectMapper,
                                 RoomService roomService,
                                 AiService aiService) {
        this.roomRepository = roomRepository;
        this.opService = opService;
        this.redisPublisher = redisPublisher;
        this.objectMapper = objectMapper;
        this.roomService = roomService;
        this.aiService = aiService;
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
    public void handleOp(@DestinationVariable("slug") String slug, OpRequestDTO request, Principal principal) {
        Room room = roomRepository.findBySlug(slug).orElse(null);
        if (room == null) {
            log.warn("Received op for non-existent room slug: {}", slug);
            return;
        }
        try {
            roomService.requireEditor(slug, principal == null ? null : java.util.UUID.fromString(principal.getName()));
        } catch (Exception denied) {
            log.warn("Rejected room mutation for {}: {}", slug, denied.getMessage()); return;
        }
        if (principal != null) {
            request.setAuthorId(principal.getName());
        } else if (request.getAuthorId() == null || request.getAuthorId().isBlank()) {
            request.setAuthorId("anonymous");
        }

        if (request.getOpType() == com.graffiti.op.OpType.AI_REQUEST) {
            Map<String, Object> body = objectMapper.convertValue(request.getPayload(), Map.class);
            CompletableFuture.runAsync(() -> broadcastGhost(slug, request.getShapeId(), aiService.toGhostPayload(aiService.request(body))));
            return;
        }

        Op op = opService.processAndSaveOp(room.getId(), request);

        try {
            Map<String, Object> broadcastPayload = new HashMap<>();
            broadcastPayload.put("type", "OP");
            String opId = (op != null && op.getId() != null)
                    ? op.getId().toString()
                    : java.util.UUID.randomUUID().toString();
            broadcastPayload.put("id", opId);
            broadcastPayload.put("roomId", room.getId().toString());
            broadcastPayload.put("shapeId", request.getShapeId());
            broadcastPayload.put("opType", request.getOpType().name());
            broadcastPayload.put("payload", request.getPayload());
            broadcastPayload.put("lamportTs", op != null ? op.getLamportTs() : (request.getLamportTs() != null ? request.getLamportTs() : 1L));
            broadcastPayload.put("authorId", (request.getAuthorId() != null) ? request.getAuthorId() : "anonymous");
            broadcastPayload.put("createdAt", (op != null && op.getCreatedAt() != null) ? op.getCreatedAt().toString() : java.time.Instant.now().toString());

            String jsonMessage = objectMapper.writeValueAsString(broadcastPayload);
            redisPublisher.publish("room:" + slug + ":op", jsonMessage);
        } catch (Exception e) {
            log.error("Error serializing op for broadcasting: {}", e.getMessage(), e);
        }
    }

    private void broadcastGhost(String slug, String requestId, Map<String, Object> payload) {
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("type", "AI_GHOST_OP"); message.put("requestId", requestId); message.put("payload", payload);
            redisPublisher.publish("room:" + slug + ":op", objectMapper.writeValueAsString(message));
        } catch (Exception e) { log.error("Unable to broadcast AI ghost: {}", e.getMessage()); }
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
    public void handlePresence(@DestinationVariable("slug") String slug, PresenceMessageDTO presence, Principal principal) {
        if (presence == null) {
            return;
        }

        try {
            String authorId = (principal != null) ? principal.getName() : presence.getAuthorId();
            if (authorId == null || authorId.isBlank()) {
                authorId = "anonymous";
            }
            Map<String, Object> broadcastPayload = new HashMap<>();
            broadcastPayload.put("type", "PRESENCE");
            broadcastPayload.put("authorId", authorId);
            broadcastPayload.put("presenceType", (presence.getType() != null) ? presence.getType() : "cursor");
            broadcastPayload.put("payload", presence.getPayload());

            String jsonMessage = objectMapper.writeValueAsString(broadcastPayload);
            redisPublisher.publish("room:" + slug + ":presence", jsonMessage);
        } catch (Exception e) {
            log.error("Error serializing presence message for broadcasting: {}", e.getMessage());
        }
    }
}
