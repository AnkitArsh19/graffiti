package com.graffiti.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graffiti.redis.RedisMessagePublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    private final RedisMessagePublisher redisPublisher;
    private final ObjectMapper objectMapper;

    // Session ID -> Active Room Slug mapping
    private final Map<String, String> sessionRoomMap = new ConcurrentHashMap<>();

    public WebSocketEventListener(RedisMessagePublisher redisPublisher, ObjectMapper objectMapper) {
        this.redisPublisher = redisPublisher;
        this.objectMapper = objectMapper;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        log.info("STOMP WebSocket Session Connected: {}", sessionId);
    }

    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String destination = headerAccessor.getDestination();

        if (destination != null && destination.startsWith("/topic/rooms/")) {
            String slug = destination.substring("/topic/rooms/".length());
            if (sessionId != null) {
                sessionRoomMap.put(sessionId, slug);
            }

            log.info("STOMP Session {} subscribed to room: {}", sessionId, slug);
            broadcastPresenceEvent(slug, sessionId, "USER_JOINED");
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String slug = (sessionId != null) ? sessionRoomMap.remove(sessionId) : null;

        log.info("STOMP WebSocket Session Disconnected: {}. Room: {}", sessionId, slug);

        if (slug != null) {
            broadcastPresenceEvent(slug, sessionId, "USER_LEFT");
        }
    }

    private void broadcastPresenceEvent(String slug, String sessionId, String eventType) {
        try {
            Map<String, Object> presenceEvent = Map.of(
                    "type", "PRESENCE",
                    "presenceType", eventType,
                    "sessionId", (sessionId != null) ? sessionId : "unknown",
                    "timestamp", System.currentTimeMillis()
            );
            String jsonMessage = objectMapper.writeValueAsString(presenceEvent);
            redisPublisher.publish("room:" + slug + ":presence", jsonMessage);
        } catch (Exception e) {
            log.error("Error broadcasting STOMP presence event for room {}: {}", slug, e.getMessage());
        }
    }
}
