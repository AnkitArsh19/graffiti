package com.graffiti;

import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
@Profile("test")
public class TestConfig {

    @Bean
    @Primary
    public RedisConnectionFactory mockRedisConnectionFactory() {
        return Mockito.mock(RedisConnectionFactory.class);
    }

    @Bean
    @Primary
    public StringRedisTemplate mockStringRedisTemplate() {
        return Mockito.mock(StringRedisTemplate.class);
    }

    @Bean
    @Primary
    public RedisMessageListenerContainer mockRedisMessageListenerContainer() {
        return Mockito.mock(RedisMessageListenerContainer.class);
    }
}
