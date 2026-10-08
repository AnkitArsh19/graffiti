package com.graffiti.user;

import java.util.UUID;

/**
 * Response DTO for user profile information.
 */
public class UserProfileResponse {
    private UUID userId;
    private String email;
    private String name;
    private String avatarUrl;
    private AuthProvider provider;

    public UserProfileResponse() {
    }

    public UserProfileResponse(UUID userId, String email, String name, String avatarUrl, AuthProvider provider) {
        this.userId = userId;
        this.email = email;
        this.name = name;
        this.avatarUrl = avatarUrl;
        this.provider = provider;
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public AuthProvider getProvider() { return provider; }
    public void setProvider(AuthProvider provider) { this.provider = provider; }
}
