package com.graffiti.ai;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller exposing synchronous AI whiteboard endpoints for direct client/desktop usage.
 */
@RestController
@RequestMapping("/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    /**
     * Executes an AI request (beautify, math, diagram, circle-query, ocr)
     * and returns the normalized ghost payload containing proposedElements.
     */
    @PostMapping("/request")
    public ResponseEntity<Map<String, Object>> handleAiRequest(@RequestBody Map<String, Object> request) {
        Map<String, Object> rawResponse = aiService.request(request);
        Map<String, Object> ghostPayload = aiService.toGhostPayload(rawResponse);
        return ResponseEntity.ok(ghostPayload);
    }
}

