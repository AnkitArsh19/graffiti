package com.graffiti.redis;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Service for publishing messages onto Redis Pub/Sub channels.
 *
 * Used to broadcast shape operations and presence events across multiple server instances.
 */
@Service
public class RedisMessagePublisher {

    private static final Logger log = LoggerFactory.getLogger(RedisMessagePublisher.class);
    private final StringRedisTemplate redisTemplate;

    public RedisMessagePublisher(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Publishes a string payload onto a specific Redis Pub/Sub topic channel.
     *
     * @param topic Target Redis channel (e.g. "room:{slug}:op", "room:{slug}:presence")
     * @param message JSON string message payload
     */
    public void publish(String topic, String message) {
        try {
            redisTemplate.convertAndSend(topic, message);
        } catch (Exception e) {
            log.error("Failed to publish message to Redis topic {}: {}", topic, e.getMessage());
        }
    }
}
