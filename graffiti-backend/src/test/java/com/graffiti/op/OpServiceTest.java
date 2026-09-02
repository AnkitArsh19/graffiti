package com.graffiti.op;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.graffiti.room.Room;
import com.graffiti.room.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class OpServiceTest {

    @Autowired
    private OpService opService;

    @Autowired
    private OpRepository opRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private UUID roomId;

    @BeforeEach
    void setUp() {
        opRepository.deleteAll();
        roomRepository.deleteAll();

        Room room = new Room("op-test-slug", null);
        roomRepository.save(room);
        roomId = room.getId();
    }

    @Test
    void testProcessAndSaveOpIncrementsLamport() {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("type", "rectangle");
        payload.put("x", 100);

        OpRequestDTO req1 = new OpRequestDTO("shape_1", OpType.CREATE_OR_UPDATE, payload, 0L, "user_alice");
        Op op1 = opService.processAndSaveOp(roomId, req1);
        assertNotNull(op1.getId());
        assertEquals(1L, op1.getLamportTs());
        assertEquals("shape_1", op1.getShapeId());

        OpRequestDTO req2 = new OpRequestDTO("shape_2", OpType.CREATE_OR_UPDATE, payload, 1L, "user_bob");
        Op op2 = opService.processAndSaveOp(roomId, req2);
        assertEquals(2L, op2.getLamportTs());

        // Test with higher client Lamport clock (e.g. client was offline and has ts=10)
        OpRequestDTO req3 = new OpRequestDTO("shape_1", OpType.CREATE_OR_UPDATE, payload, 10L, "user_alice");
        Op op3 = opService.processAndSaveOp(roomId, req3);
        assertEquals(11L, op3.getLamportTs());

        List<Op> opsAfter1 = opService.getOpsAfterLamport(roomId, 1L);
        assertEquals(2, opsAfter1.size());
    }

    @Test
    void testWriteBehindBufferFlushBatching() {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("type", "ellipse");
        payload.put("radius", 50);

        // Manually trigger buffer operations
        Op op = new Op(roomId, "buffered_shape_1", OpType.CREATE_OR_UPDATE, payload, 100L, "worker");
        opRepository.save(op);

        opService.flushBuffer();
        List<Op> ops = opService.getOpsAfterLamport(roomId, 99L);
        assertEquals(1, ops.size());
        assertEquals("buffered_shape_1", ops.get(0).getShapeId());
    }
}
