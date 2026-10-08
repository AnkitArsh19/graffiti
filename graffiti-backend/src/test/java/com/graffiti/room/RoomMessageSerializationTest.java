package com.graffiti.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graffiti.op.OpRequestDTO;
import com.graffiti.op.OpType;
import com.graffiti.presence.PresenceMessageDTO;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RoomMessageSerializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void testPresenceMessageDeserialization() throws Exception {
        String json = """
            {
                "authorId": "user-123",
                "type": "cursor",
                "payload": {"x": 150.5, "y": 300.0, "name": "Alice"}
            }
        """;
        PresenceMessageDTO dto = mapper.readValue(json, PresenceMessageDTO.class);
        assertNotNull(dto);
        assertEquals("user-123", dto.getAuthorId());
        assertEquals("cursor", dto.getType());
        assertNotNull(dto.getPayload());
        assertTrue(dto.getPayload() instanceof Map);
    }

    @Test
    void testOpRequestDeserialization() throws Exception {
        String json = """
            {
                "shapeId": "el_456",
                "opType": "CREATE_OR_UPDATE",
                "payload": {"id": "el_456", "type": "pen", "points": [{"x":0,"y":0}]},
                "lamportTs": 5,
                "authorId": "user-123"
            }
        """;
        OpRequestDTO dto = mapper.readValue(json, OpRequestDTO.class);
        assertNotNull(dto);
        assertEquals("el_456", dto.getShapeId());
        assertEquals(OpType.CREATE_OR_UPDATE, dto.getOpType());
        assertNotNull(dto.getPayload());
        assertEquals(5L, dto.getLamportTs());
        assertTrue(dto.getPayload() instanceof Map);
    }
}
