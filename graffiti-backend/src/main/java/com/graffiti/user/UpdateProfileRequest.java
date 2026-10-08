package com.graffiti.user;

/**
 * Request DTO for updating user profile fields.
 */
public class UpdateProfileRequest {
    private String name;
    private String avatarUrl;

    public UpdateProfileRequest() {
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
}
