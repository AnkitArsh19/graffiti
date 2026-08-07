package com.graffiti.op;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Data Transfer Object sent by clients over WebSocket mapping SEND /app/rooms/{slug}/op.
 */
public class OpRequestDTO {
    private String shapeId;
    private OpType opType;
    private JsonNode payload;
    private Long lamportTs;
    private String authorId;

    public OpRequestDTO() {
    }

    public OpRequestDTO(String shapeId, OpType opType, JsonNode payload, Long lamportTs, String authorId) {
        this.shapeId = shapeId;
        this.opType = opType;
        this.payload = payload;
        this.lamportTs = lamportTs;
        this.authorId = authorId;
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
}
