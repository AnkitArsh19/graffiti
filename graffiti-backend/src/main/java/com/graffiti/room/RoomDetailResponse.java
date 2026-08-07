package com.graffiti.room;

import com.fasterxml.jackson.databind.JsonNode;
import com.graffiti.op.Op;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTO returned when clients request full details of a whiteboard room (GET /rooms/{slug}).
 *
 * Contains metadata, latest consolidated snapshot JSON state, upToLamportTs checkpoint,
 * and list of un-compacted operations executed after the snapshot.
 */
public class RoomDetailResponse {
    private UUID id;
    private String slug;
    private UUID ownerId;
    private Instant createdAt;
    private JsonNode snapshotState;
    private Long upToLamportTs;
    private List<Op> opsSinceSnapshot;

    public RoomDetailResponse() {
    }

    public RoomDetailResponse(UUID id, String slug, UUID ownerId, Instant createdAt,
                              JsonNode snapshotState, Long upToLamportTs, List<Op> opsSinceSnapshot) {
        this.id = id;
        this.slug = slug;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
        this.snapshotState = snapshotState;
        this.upToLamportTs = upToLamportTs;
        this.opsSinceSnapshot = opsSinceSnapshot;
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

    public JsonNode getSnapshotState() {
        return snapshotState;
    }

    public void setSnapshotState(JsonNode snapshotState) {
        this.snapshotState = snapshotState;
    }

    public Long getUpToLamportTs() {
        return upToLamportTs;
    }

    public void setUpToLamportTs(Long upToLamportTs) {
        this.upToLamportTs = upToLamportTs;
    }

    public List<Op> getOpsSinceSnapshot() {
        return opsSinceSnapshot;
    }

    public void setOpsSinceSnapshot(List<Op> opsSinceSnapshot) {
        this.opsSinceSnapshot = opsSinceSnapshot;
    }
}
