package com.graffiti.redis;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Subscriber listening for Redis Pub/Sub messages across room channels.
 *
 * When a message arrives on Redis channel "room:{slug}:op" or "room:{slug}:presence",
 * this service parses the room slug and forwards the payload to STOMP WebSocket subscribers
 * connected at destination "/topic/rooms/{slug}".
 */
@Service
public class RedisMessageSubscriber {

    private static final Logger log = LoggerFactory.getLogger(RedisMessageSubscriber.class);
    private final SimpMessagingTemplate messagingTemplate;

    public RedisMessageSubscriber(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Callback method invoked when a message is published onto a subscribed Redis topic.
     *
     * @param message Message payload string
     * @param channel Source Redis channel name
     */
    public void onMessage(String message, String channel) {
        log.debug("Received Redis message on channel {}: {}", channel, message);
        if (channel != null && channel.startsWith("room:")) {
            String[] parts = channel.split(":");
            if (parts.length >= 3) {
                String slug = parts[1];
                String destination = "/topic/rooms/" + slug;
                messagingTemplate.convertAndSend(destination, message);
            }
        }
    }
}
