package com.graffiti.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

/**
 * Configuration class for Redis templates, pub/sub topic listeners, and message adapters.
 *
 * Listens on Redis channels matching pattern "room:*" to support multi-node scaling of canvas events.
 */
@Configuration
public class RedisConfig {

    /**
     * Creates a StringRedisTemplate bean for publishing and key-value distributed lock management.
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    /**
     * Configures the MessageListenerAdapter targeting RedisMessageSubscriber.onMessage method.
     */
    @Bean
    public MessageListenerAdapter messageListenerAdapter(RedisMessageSubscriber subscriber) {
        return new MessageListenerAdapter(subscriber, "onMessage");
    }

    /**
     * Registers the RedisMessageListenerContainer for topic pattern "room:*".
     * Disabled in test profile to allow running tests without an active Redis server.
     */
    @Bean
    @Profile("!test")
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter listenerAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listenerAdapter, new PatternTopic("room:*"));
        return container;
    }
}
