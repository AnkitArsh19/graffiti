package com.graffiti.crdt;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.graffiti.op.Op;
import com.graffiti.op.OpType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class CrdtMergeServiceTest {

    private CrdtMergeService crdtMergeService;
    private ObjectMapper objectMapper;
    private UUID roomId;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        crdtMergeService = new CrdtMergeService(objectMapper);
        roomId = UUID.randomUUID();
    }

    @Test
    @DisplayName("Verify merge operation is commutative: order of applying ops produces identical state")
    void testCommutativeMerge() {
        ObjectNode p1 = objectMapper.createObjectNode().put("color", "red").put("x", 10);
        ObjectNode p2 = objectMapper.createObjectNode().put("color", "blue").put("x", 20);
        ObjectNode p3 = objectMapper.createObjectNode().put("color", "green").put("x", 30);

        Op op1 = new Op(roomId, "shape-1", OpType.CREATE_OR_UPDATE, p1, 1L, "author-A");
        Op op2 = new Op(roomId, "shape-1", OpType.CREATE_OR_UPDATE, p2, 2L, "author-B");
        Op op3 = new Op(roomId, "shape-2", OpType.CREATE_OR_UPDATE, p3, 1L, "author-A");
        Op op4 = new Op(roomId, "shape-1", OpType.DELETE, objectMapper.createObjectNode(), 3L, "author-A");

        List<Op> listOrder1 = List.of(op1, op2, op3, op4);
        List<Op> listOrder2 = List.of(op4, op3, op2, op1);
        List<Op> listOrder3 = List.of(op2, op4, op1, op3);

        Map<String, ShapeState> state1 = crdtMergeService.mergeOps(listOrder1);
        Map<String, ShapeState> state2 = crdtMergeService.mergeOps(listOrder2);
        Map<String, ShapeState> state3 = crdtMergeService.mergeOps(listOrder3);

        assertEquals(state1, state2, "State 1 and State 2 must be identical regardless of op order");
        assertEquals(state2, state3, "State 2 and State 3 must be identical regardless of op order");
        assertTrue(state1.get("shape-1").isDeleted(), "shape-1 should be tombstoned");
        assertEquals("shape-2", state1.get("shape-2").getShapeId());
    }

    @Test
    @DisplayName("Verify merge operation is idempotent: applying duplicate ops does not change state")
    void testIdempotentMerge() {
        ObjectNode p1 = objectMapper.createObjectNode().put("type", "rectangle");
        Op op1 = new Op(roomId, "shape-100", OpType.CREATE_OR_UPDATE, p1, 5L, "user-1");

        Map<String, ShapeState> stateSingle = crdtMergeService.mergeOps(List.of(op1));
        Map<String, ShapeState> stateDuplicate = crdtMergeService.mergeOps(List.of(op1, op1, op1));

        assertEquals(stateSingle, stateDuplicate, "Duplicate ops application must result in identical state");
    }

    @Test
    @DisplayName("Verify tie-breaking by authorId when Lamport timestamps are equal")
    void testLamportTimestampTieBreak() {
        ObjectNode pA = objectMapper.createObjectNode().put("val", "AuthorA");
        ObjectNode pB = objectMapper.createObjectNode().put("val", "AuthorB");

        // Same timestamp 10L, author-B string > author-A
        Op opA = new Op(roomId, "shape-99", OpType.CREATE_OR_UPDATE, pA, 10L, "author-A");
        Op opB = new Op(roomId, "shape-99", OpType.CREATE_OR_UPDATE, pB, 10L, "author-B");

        Map<String, ShapeState> stateForward = crdtMergeService.mergeOps(List.of(opA, opB));
        Map<String, ShapeState> stateReverse = crdtMergeService.mergeOps(List.of(opB, opA));

        assertEquals(stateForward, stateReverse);
        assertEquals("author-B", stateForward.get("shape-99").getAuthorId());
        assertEquals("AuthorB", stateForward.get("shape-99").getPayload().get("val").asText());
    }
}
