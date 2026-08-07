package com.graffiti.crdt;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Objects;

/**
 * ShapeState represents the resolved visual and structural state of a single element (shape)
 * on the collaborative canvas.
 *
 * Each shape maintains a unique shapeId, a JSON payload describing its attributes (geometry, color, points),
 * a Lamport timestamp indicating when the update occurred, the author ID of the last editor, and a boolean
 * flag indicating whether the shape has been deleted (tombstoned).
 */
public class ShapeState {
    private String shapeId;
    private JsonNode payload;
    private Long lamportTs;
    private String authorId;
    private boolean deleted;

    public ShapeState() {
    }

    public ShapeState(String shapeId, JsonNode payload, Long lamportTs, String authorId, boolean deleted) {
        this.shapeId = shapeId;
        this.payload = payload;
        this.lamportTs = lamportTs;
        this.authorId = authorId;
        this.deleted = deleted;
    }

    public String getShapeId() {
        return shapeId;
    }

    public void setShapeId(String shapeId) {
        this.shapeId = shapeId;
    }

    public JsonNode getPayload() {
        return payload;
    }

    public void setPayload(JsonNode payload) {
        this.payload = payload;
    }

    public Long getLamportTs() {
        return lamportTs;
    }

    public void setLamportTs(Long lamportTs) {
        this.lamportTs = lamportTs;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ShapeState that = (ShapeState) o;
        return deleted == that.deleted &&
                Objects.equals(shapeId, that.shapeId) &&
                Objects.equals(payload, that.payload) &&
                Objects.equals(lamportTs, that.lamportTs) &&
                Objects.equals(authorId, that.authorId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(shapeId, payload, lamportTs, authorId, deleted);
    }

    @Override
    public String toString() {
        return "ShapeState{" +
                "shapeId='" + shapeId + '\'' +
                ", payload=" + payload +
                ", lamportTs=" + lamportTs +
                ", authorId='" + authorId + '\'' +
                ", deleted=" + deleted +
                '}';
    }
}
