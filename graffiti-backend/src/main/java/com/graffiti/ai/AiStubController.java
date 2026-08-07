package com.graffiti.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller providing a stubbed internal endpoint for future AI-powered whiteboard generation.
 *
 * Endpoint: POST /internal/rooms/{slug}/ai-suggestion
 * Serves as an integration placeholder for background LLM / generative shape services.
 */
@RestController
@RequestMapping("/internal/rooms")
public class AiStubController {

    private static final Logger log = LoggerFactory.getLogger(AiStubController.class);

    /**
     * Accepts an AI suggestion request for a specific room slug.
     * Logs the incoming payload and returns a stubbed success response.
     *
     * @param slug Target room slug
     * @param payload Optional request payload parameters for AI generation
     * @return ResponseEntity with STUBBED_ACCEPTED status
     */
    @PostMapping("/{slug}/ai-suggestion")
    public ResponseEntity<?> handleAiSuggestion(@PathVariable("slug") String slug, @RequestBody(required = false) Map<String, Object> payload) {
        log.info("Received AI suggestion request for room slug: {}. Payload: {}", slug, payload);
        return ResponseEntity.ok(Map.of("status", "STUBBED_ACCEPTED", "roomSlug", slug, "message", "AI service integration is stubbed"));
    }
}
