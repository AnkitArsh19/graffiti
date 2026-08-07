package com.graffiti.compaction;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.graffiti.op.Op;
import com.graffiti.op.OpRepository;
import com.graffiti.op.OpType;
import com.graffiti.room.Room;
import com.graffiti.room.RoomRepository;
import com.graffiti.snapshot.CompactionService;
import com.graffiti.snapshot.Snapshot;
import com.graffiti.snapshot.SnapshotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class CompactionServiceTest {

    @Autowired
    private CompactionService compactionService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private OpRepository opRepository;

    @Autowired
    private SnapshotRepository snapshotRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Room testRoom;

    @BeforeEach
    void setUp() {
        opRepository.deleteAll();
        snapshotRepository.deleteAll();
        roomRepository.deleteAll();

        testRoom = roomRepository.save(new Room("compaction-test-slug", null));
    }

    @Test
    void testSnapshotCompactionWhenOpsExceedThreshold() {
        // Create 60 ops (exceeding threshold of 50)
        for (int i = 1; i <= 60; i++) {
            ObjectNode payload = objectMapper.createObjectNode().put("version", i);
            Op op = new Op(testRoom.getId(), "shape-1", OpType.CREATE_OR_UPDATE, payload, (long) i, "author-1");
            opRepository.save(op);
        }

        boolean compacted = compactionService.compactRoomIfNecessary(testRoom.getId());
        assertTrue(compacted, "Compaction should be triggered when ops count exceeds 50");

        Snapshot snapshot = snapshotRepository.findTopByRoomIdOrderByUpToLamportTsDesc(testRoom.getId()).orElse(null);
        assertNotNull(snapshot, "Compaction snapshot should be created in DB");
        assertEquals(60L, snapshot.getUpToLamportTs());
        assertNotNull(snapshot.getState().get("shape-1"));
        assertEquals(60, snapshot.getState().get("shape-1").get("payload").get("version").asInt());
    }
}
