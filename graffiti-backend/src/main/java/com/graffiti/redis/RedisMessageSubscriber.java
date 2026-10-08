package com.graffiti.redis;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Subscriber listening for Redis Pub/Sub messages across room channels.
 *
 * When a message arrives on Redis channel "room:{slug}:op" or "room:{slug}:presence",
 * this service parses the room slug and forwards the payload to STOMP WebSocket subscribers
 * connected at destination "/topic/rooms/{slug}".
 */
@Service
public class RedisMessageSubscriber implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(RedisMessageSubscriber.class);
    private final SimpMessagingTemplate messagingTemplate;

    public RedisMessageSubscriber(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Native Redis MessageListener callback parsing raw byte arrays without serializer overhead.
     */
    @Override
    public void onMessage(Message message, byte[] pattern) {
        if (message == null || message.getBody() == null || message.getChannel() == null) {
            return;
        }
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        String channel = new String(message.getChannel(), StandardCharsets.UTF_8);
        forwardMessage(body, channel);
    }

    /**
     * Fallback method if called via String reflection.
     */
    public void onMessage(String message, String channel) {
        forwardMessage(message, channel);
    }

    private void forwardMessage(String message, String channel) {
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
