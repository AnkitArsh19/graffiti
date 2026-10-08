package com.graffiti.room;

import java.time.Instant;
import java.util.UUID;

/**
 * Response DTO for room list items.
 */
public class RoomListResponse {
    private UUID id;
    private String slug;
    private String name;
    private boolean isPublic;
    private UUID ownerId;
    private Instant createdAt;
    private Instant updatedAt;
    private String role;
    private int memberCount;
    private UUID workspaceId;
    private UUID folderId;

    public RoomListResponse() {
    }

    public RoomListResponse(UUID id, String slug, String name, boolean isPublic,
                            UUID ownerId, Instant createdAt, Instant updatedAt,
                            String role, int memberCount) {
        this.id = id;
        this.slug = slug;
        this.name = name;
        this.isPublic = isPublic;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.role = role;
        this.memberCount = memberCount;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isPublic() { return isPublic; }
    public void setPublic(boolean isPublic) { this.isPublic = isPublic; }
    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public int getMemberCount() { return memberCount; }
    public void setMemberCount(int memberCount) { this.memberCount = memberCount; }
    public UUID getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(UUID workspaceId) { this.workspaceId = workspaceId; }
    public UUID getFolderId() { return folderId; }
    public void setFolderId(UUID folderId) { this.folderId = folderId; }
}
