package com.graffiti.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AiServiceTest {

    private AiService aiService;

    @BeforeEach
    void setUp() {
        // Connect to a non-existent port with small timeout to test failure isolation
        aiService = new AiService("http://127.0.0.1:59999", 500);
    }

    @Test
    void testToGhostPayloadNullOrEmpty() {
        Map<String, Object> nullResult = aiService.toGhostPayload(null);
        assertNotNull(nullResult);
        assertEquals(false, nullResult.get("ghostPreview"));
        assertTrue(((List<?>) nullResult.get("proposedElements")).isEmpty());

        Map<String, Object> emptyResult = aiService.toGhostPayload(Map.of());
        assertNotNull(emptyResult);
        assertEquals(false, emptyResult.get("ghostPreview"));
        assertTrue(((List<?>) emptyResult.get("proposedElements")).isEmpty());
    }

    @Test
    void testToGhostPayloadWithProposedElement() {
        Map<String, Object> mathResponse = Map.of(
                "action", "solve",
                "proposedElement", Map.of("type", "text", "text", "= 42", "x", 100, "y", 200)
        );

        Map<String, Object> ghost = aiService.toGhostPayload(mathResponse);
        assertEquals(true, ghost.get("ghostPreview"));
        List<?> elements = (List<?>) ghost.get("proposedElements");
        assertNotNull(elements);
        assertEquals(1, elements.size());
        assertEquals("text", ((Map<?, ?>) elements.get(0)).get("type"));
    }

    @Test
    void testToGhostPayloadWithPayload() {
        Map<String, Object> beautifyResponse = Map.of(
                "shape", "rectangle",
                "confidence", 0.95,
                "payload", Map.of("type", "rect", "x", 10, "y", 20, "w", 100, "h", 50)
        );

        Map<String, Object> ghost = aiService.toGhostPayload(beautifyResponse);
        assertEquals(true, ghost.get("ghostPreview"));
        List<?> elements = (List<?>) ghost.get("proposedElements");
        assertNotNull(elements);
        assertEquals(1, elements.size());
        assertEquals("rect", ((Map<?, ?>) elements.get(0)).get("type"));
    }

    @Test
    void testToGhostPayloadWithExistingProposedElements() {
        Map<String, Object> diagramResponse = Map.of(
                "proposedElements", List.of(
                        Map.of("id", "1", "type", "box"),
                        Map.of("id", "2", "type", "arrow")
                )
        );

        Map<String, Object> ghost = aiService.toGhostPayload(diagramResponse);
        assertEquals(true, ghost.get("ghostPreview"));
        List<?> elements = (List<?>) ghost.get("proposedElements");
        assertEquals(2, elements.size());
    }

    @Test
    void testRequestGracefulFailureWhenServiceOffline() {
        Map<String, Object> result = aiService.request(Map.of("feature", "beautify", "points", List.of()));
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void testRequestNullRequest() {
        Map<String, Object> result = aiService.request(null);
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }
}

