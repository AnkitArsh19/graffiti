package com.graffiti.room;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO returned upon successful room creation or claiming.
 */
public class CreateRoomResponse {
    private UUID id;
    private String slug;
    private UUID ownerId;
    private Instant createdAt;

    public CreateRoomResponse() {
    }

    public CreateRoomResponse(UUID id, String slug, UUID ownerId, Instant createdAt) {
        this.id = id;
        this.slug = slug;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
