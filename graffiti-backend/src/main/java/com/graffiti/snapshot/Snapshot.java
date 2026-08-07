package com.graffiti.snapshot;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA Entity representing a consolidated room state snapshot stored in PostgreSQL.
 *
 * Contains:
 * - state: Native PostgreSQL JSONB column representing consolidated canvas state map (Shape ID -> ShapeState)
 * - upToLamportTs: Maximum Lamport timestamp incorporated into this snapshot
 */
@Entity
@Table(name = "snapshots", indexes = {
    @Index(name = "idx_snapshots_room_lamport", columnList = "room_id, up_to_lamport_ts DESC")
})
public class Snapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode state;

    @Column(name = "up_to_lamport_ts", nullable = false)
    private Long upToLamportTs;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Snapshot() {
    }

    public Snapshot(UUID roomId, JsonNode state, Long upToLamportTs) {
        this.roomId = roomId;
        this.state = state;
        this.upToLamportTs = upToLamportTs;
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

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public JsonNode getState() {
        return state;
    }

    public void setState(JsonNode state) {
        this.state = state;
    }

    public Long getUpToLamportTs() {
        return upToLamportTs;
    }

    public void setUpToLamportTs(Long upToLamportTs) {
        this.upToLamportTs = upToLamportTs;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
