package com.graffiti.op;

/**
 * Data Transfer Object sent by clients over WebSocket mapping SEND /app/rooms/{slug}/op.
 */
public class OpRequestDTO {
    private String shapeId;
    private OpType opType;
    private Object payload;
    private Long lamportTs;
    private String authorId;

    public OpRequestDTO() {
    }

    public OpRequestDTO(String shapeId, OpType opType, Object payload, Long lamportTs, String authorId) {
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

    public Object getPayload() {
        return payload;
    }

    public void setPayload(Object payload) {
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
