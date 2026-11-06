package com.graffiti.ai;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AiControllerTest {

    @Test
    void testHandleAiRequestReturnsGhostPayload() {
        AiService fakeAiService = new AiService("http://127.0.0.1:59999", 500) {
            @Override
            public Map<String, Object> request(Map<String, Object> request) {
                return Map.of("payload", Map.of("type", "rectangle"));
            }

            @Override
            public Map<String, Object> toGhostPayload(Map<String, Object> response) {
                return Map.of(
                        "payload", Map.of("type", "rectangle"),
                        "proposedElements", List.of(Map.of("type", "rectangle")),
                        "ghostPreview", true
                );
            }
        };

        AiController controller = new AiController(fakeAiService);

        Map<String, Object> incoming = Map.of("feature", "diagram", "prompt", "User service");
        ResponseEntity<Map<String, Object>> response = controller.handleAiRequest(incoming);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("ghostPreview"));
        List<?> proposed = (List<?>) body.get("proposedElements");
        assertEquals(1, proposed.size());
    }
}
