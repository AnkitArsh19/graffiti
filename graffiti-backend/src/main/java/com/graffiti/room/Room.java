package com.graffiti.room;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * JPA Entity representing a whiteboard room.
 *
 * Each room has a unique UUID, a short human-readable unique slug (e.g. "a1b2c3d4"),
 * an optional ownerId (null for anonymous public rooms), and a creation timestamp.
 */
@Entity
@Table(name = "rooms", indexes = {
    @Index(name = "idx_rooms_slug", columnList = "slug", unique = true)
})
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Room() {
    }

    public Room(String slug, UUID ownerId) {
        this.slug = slug;
        this.ownerId = ownerId;
        this.createdAt = Instant.now();
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
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
