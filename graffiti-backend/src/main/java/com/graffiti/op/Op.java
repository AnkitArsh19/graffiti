package com.graffiti.op;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA Entity representing an individual canvas operation (Op) stored in PostgreSQL.
 *
 * Each operation contains:
 * - shapeId: Target canvas shape identifier
 * - opType: Operation type (CREATE_OR_UPDATE or DELETE)
 * - payload: Native PostgreSQL JSONB column storing shape geometry, attributes, and styles
 * - lamportTs: Monotonically increasing Lamport clock timestamp assigned upon persistence
 * - authorId: User ID or client session ID executing the edit
 */
@Entity
@Table(name = "ops", indexes = {
    @Index(name = "idx_ops_room_lamport", columnList = "room_id, lamport_ts")
})
public class Op {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "shape_id", nullable = false)
    private String shapeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "op_type", nullable = false)
    private OpType opType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode payload;

    @Column(name = "lamport_ts", nullable = false)
    private Long lamportTs;

    @Column(name = "author_id", nullable = false)
    private String authorId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Op() {
    }

    public Op(UUID roomId, String shapeId, OpType opType, JsonNode payload, Long lamportTs, String authorId) {
        this.roomId = roomId;
        this.shapeId = shapeId;
        this.opType = opType;
        this.payload = payload;
        this.lamportTs = lamportTs;
        this.authorId = authorId;
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

    public String getShapeId() {
        return shapeId;
    }

    public void setShapeId(String shapeId) {
        this.shapeId = shapeId;
    }

    public OpType getOpType() {
        return opType;
    }

    public void setOpType(OpType opType) {
        this.opType = opType;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
