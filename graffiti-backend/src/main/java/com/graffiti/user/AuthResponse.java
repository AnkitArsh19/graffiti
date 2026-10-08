package com.graffiti.user;

import java.util.UUID;

/**
 * Response DTO returned upon successful registration or login containing JWT bearer token.
 */
public class AuthResponse {
    private String token;
    private UUID userId;
    private String email;
    private String name;
    private String avatarUrl;

    public AuthResponse() {
    }

    public AuthResponse(String token, UUID userId, String email, String name, String avatarUrl) {
        this.token = token;
        this.userId = userId;
        this.email = email;
        this.name = name;
        this.avatarUrl = avatarUrl;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
}
