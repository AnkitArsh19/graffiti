package com.graffiti.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Small, failure-isolated proxy for the optional AI service. */
@Service
public class AiService {
    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private final RestClient client;

    public AiService(@Value("${app.aiml.url:http://localhost:8000}") String baseUrl,
                     @Value("${app.aiml.timeout-ms:8000}") int timeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> request(Map<String, Object> request) {
        if (request == null) {
            return Map.of();
        }
        Map<String, Object> body = new LinkedHashMap<>(request);
        String feature = String.valueOf(body.getOrDefault("feature", "beautify"));

        // Normalize anchor coordinates if passed as "anchor"
        if (body.containsKey("anchor") && !body.containsKey("anchorPosition")) {
            body.put("anchorPosition", body.get("anchor"));
        }

        String path = switch (feature) {
            case "math"               -> "/v1/ai/math/solve";
            case "circle-query"       -> "/v1/ai/gesture/circle-query";
            case "diagram"            -> "/v1/ai/diagram/synthesize";
            case "ocr"                -> "/v1/ai/ocr/recognize";
            case "mindmap"            -> "/v1/ai/mindmap/auto-layout";
            case "flowchart-to-code"  -> "/v1/ai/flowchart/to-code";
            case "notebook-summarize" -> "/v1/ai/notebook/summarize";
            case "theme-morph"        -> "/v1/ai/theme/morph";
            case "flow-simulate"      -> "/v1/ai/flow/simulate";
            case "voice-storyboard"   -> "/v1/ai/voice/storyboard";
            default                   -> "/v1/ai/beautify";
        };

        try {
            Map<String, Object> response = client.post().uri(path).body(body).retrieve().body(Map.class);
            return response == null ? Map.of() : response;
        } catch (Exception ex) {
            log.info("AI request {} unavailable: {}", feature, ex.getMessage());
            return Map.of();
        }
    }

    /** Direct proxy forwarding to an internal AI/ML endpoint path. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> forwardPost(String path, Map<String, Object> body) {
        try {
            Map<String, Object> response = client.post()
                    .uri(path)
                    .body(body != null ? body : Map.of())
                    .retrieve()
                    .body(Map.class);
            return response == null ? Map.of() : response;
        } catch (Exception ex) {
            log.info("AI forward to {} failed: {}", path, ex.getMessage());
            return Map.of("error", ex.getMessage());
        }
    }

    /** Normalizes the optional service response into a client-renderable ghost payload with proposedElements array. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> toGhostPayload(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            return Map.of("proposedElements", Collections.emptyList(), "ghostPreview", false);
        }

        Map<String, Object> result = new LinkedHashMap<>(response);
        Object proposed = result.get("proposedElements");
        if (proposed == null) proposed = result.get("elements");
        if (proposed == null) proposed = result.get("updatedElements");
        if (proposed == null) proposed = result.get("newElements");

        // Special handling for MindMap which returns nodes + connectors
        if (proposed == null && result.get("nodes") instanceof List<?> nodes) {
            List<Object> combined = new ArrayList<>(nodes);
            if (result.get("connectors") instanceof List<?> connectors) {
                combined.addAll(connectors);
            }
            proposed = combined;
        }

        // Support math solver response which returns a single "proposedElement"
        if (proposed == null && result.containsKey("proposedElement") && result.get("proposedElement") != null) {
            proposed = List.of(result.get("proposedElement"));
        }

        // Support beautify response which returns a single shape "payload"
        if (proposed == null && result.containsKey("payload") && result.get("payload") != null) {
            Object payloadObj = result.get("payload");
            if (payloadObj instanceof List) {
                proposed = payloadObj;
            } else {
                proposed = List.of(payloadObj);
            }
        }

        List<?> proposedList = (proposed instanceof List) ? (List<?>) proposed : Collections.emptyList();
        result.put("proposedElements", proposedList);
        result.put("ghostPreview", !proposedList.isEmpty());
        return result;
    }
}
