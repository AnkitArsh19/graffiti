package com.graffiti.websocket;

import com.graffiti.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.UUID;

@Component
public class WebSocketSecurityInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(WebSocketSecurityInterceptor.class);
    private final JwtTokenProvider tokenProvider;

    public WebSocketSecurityInterceptor(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String bearerToken = accessor.getFirstNativeHeader("Authorization");
            if (!StringUtils.hasText(bearerToken)) {
                // Check query string token param if header not provided
                String tokenParam = accessor.getFirstNativeHeader("token");
                if (StringUtils.hasText(tokenParam)) {
                    bearerToken = "Bearer " + tokenParam;
                }
            }

            if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
                String token = bearerToken.substring(7);
                if (tokenProvider.validateToken(token)) {
                    UUID userId = tokenProvider.getUserIdFromToken(token);
                    String email = tokenProvider.getEmailFromToken(token);

                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                            userId, null, Collections.emptyList()
                    );
                    accessor.setUser(auth);
                    log.info("Authenticated WebSocket connection for user: {} ({})", email, userId);
                } else {
                    log.warn("Invalid JWT token provided in WebSocket CONNECT frame");
                }
            } else {
                log.info("Anonymous WebSocket connection established");
            }
        }
        return message;
    }
}
