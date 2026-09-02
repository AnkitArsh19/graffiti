package com.graffiti.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller providing a protected internal endpoint for AI-powered whiteboard generation.
 *
 * Endpoint: POST /internal/rooms/{slug}/ai-suggestion
 * Requires internal secret header (X-Internal-Secret) matching app.internal.api-secret.
 */
@RestController
@RequestMapping("/internal/rooms")
public class AiStubController {

    private static final Logger log = LoggerFactory.getLogger(AiStubController.class);

    @Value("${app.internal.api-secret:graffiti_internal_ai_secret_key_1907}")
    private String internalSecret;

    /**
     * Accepts an AI suggestion request for a specific room slug.
     * Validates internal secret header, logs the incoming payload, and returns a stubbed success response.
     *
     * @param slug Target room slug
     * @param providedSecret Header token (X-Internal-Secret)
     * @param payload Optional request payload parameters for AI generation
     * @return ResponseEntity with STUBBED_ACCEPTED status or 403 Forbidden
     */
    @PostMapping("/{slug}/ai-suggestion")
    public ResponseEntity<?> handleAiSuggestion(
            @PathVariable("slug") String slug,
            @RequestHeader(value = "X-Internal-Secret", required = false) String providedSecret,
            @RequestBody(required = false) Map<String, Object> payload) {

        if (providedSecret == null || !providedSecret.equals(internalSecret)) {
            log.warn("Unauthorized attempt to access internal AI endpoint for room slug: {}", slug);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", Map.of(
                            "code", "FORBIDDEN",
                            "message", "Invalid or missing internal secret header (X-Internal-Secret)",
                            "status", 403
                    )
            ));
        }

        log.info("Received authenticated AI suggestion request for room slug: {}. Payload: {}", slug, payload);
        return ResponseEntity.ok(Map.of(
                "status", "STUBBED_ACCEPTED",
                "roomSlug", slug,
                "message", "AI service integration is stubbed"
        ));
    }
}
