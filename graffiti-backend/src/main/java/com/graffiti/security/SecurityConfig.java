package com.graffiti.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Main Spring Security configuration class.
 *
 * Configures:
 * 1. Stateless session management (SessionCreationPolicy.STATELESS).
 * 2. Permit rules for public endpoints (/auth/**, /rooms, /ws/**, /oauth2/**, /login/**).
 * 3. OAuth2 Client social login integration using Google OAuth2.
 * 4. JWT bearer token security filter insertion prior to UsernamePasswordAuthenticationFilter.
 * 5. PasswordEncoder (BCrypt) and ObjectMapper beans.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          OAuth2SuccessHandler oAuth2SuccessHandler) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.oAuth2SuccessHandler = oAuth2SuccessHandler;
    }

    /**
     * Configures HTTP Security Filter Chain rules.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**", "/rooms", "/rooms/*", "/workspaces/**", "/folders/**", "/ws/**", "/internal/**", "/oauth2/**", "/login/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2
                        .successHandler(oAuth2SuccessHandler)
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * PasswordEncoder bean using BCrypt hashing.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Jackson ObjectMapper bean for JSON serialization/deserialization.
     */
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
