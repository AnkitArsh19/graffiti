package com.graffiti.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
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
        factory.setConnectTimeout(timeoutMs); factory.setReadTimeout(timeoutMs);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> request(Map<String, Object> request) {
        String feature = String.valueOf(request.getOrDefault("feature", "beautify"));
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
            Map<String, Object> response = client.post().uri(path).body(request).retrieve().body(Map.class);
            return response == null ? Map.of() : response;
        } catch (Exception ex) {
            log.info("AI request {} unavailable: {}", feature, ex.getMessage());
            return Map.of();
        }
    }

    /** Normalizes the optional service response into a client-renderable ghost payload. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> toGhostPayload(Map<String, Object> response) {
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

        result.put("proposedElements", proposed == null ? java.util.List.of() : proposed);
        result.put("ghostPreview", true);
        return result;
    }
}
