package com.graffiti.presence;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Data Transfer Object for ephemeral user presence events (cursor coordinates, active selections, laser pointer trails).
 *
 * Ephemeral events bypass database disk writes entirely and stream directly across Redis Pub/Sub channels.
 */
public class PresenceMessageDTO {
    private String authorId;
    private String type; // Presence event type (e.g. "cursor", "selection", "laser")
    private JsonNode payload; // Coordinates and cursor metadata JSON

    public PresenceMessageDTO() {
    }

    public PresenceMessageDTO(String authorId, String type, JsonNode payload) {
        this.authorId = authorId;
        this.type = type;
        this.payload = payload;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public JsonNode getPayload() {
        return payload;
    }

    public void setPayload(JsonNode payload) {
        this.payload = payload;
    }
}
