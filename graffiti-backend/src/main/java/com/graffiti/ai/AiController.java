package com.graffiti.ai;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller exposing synchronous AI whiteboard endpoints for direct client/desktop usage.
 */
@RestController
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    /**
     * Executes an AI request (beautify, math, diagram, circle-query, ocr)
     * and returns the normalized ghost payload containing proposedElements.
     */
    @PostMapping("/ai/request")
    public ResponseEntity<Map<String, Object>> handleAiRequest(@RequestBody Map<String, Object> request) {
        Map<String, Object> rawResponse = aiService.request(request);
        Map<String, Object> ghostPayload = aiService.toGhostPayload(rawResponse);
        return ResponseEntity.ok(ghostPayload);
    }

    /**
     * Direct gateway reverse-proxy for specialized AI endpoints
     * (e.g. /v1/ai/theme/morph, /v1/ai/mindmap/auto-layout, /v1/ai/flow/simulate).
     */
    @PostMapping("/v1/ai/{*subpath}")
    public ResponseEntity<Map<String, Object>> proxyAiEndpoint(
            @PathVariable("subpath") String subpath,
            @RequestBody(required = false) Map<String, Object> body) {
        String fullPath = "/v1/ai" + (subpath != null ? (subpath.startsWith("/") ? subpath : "/" + subpath) : "");
        Map<String, Object> response = aiService.forwardPost(fullPath, body);
        return ResponseEntity.ok(response);
    }
}

