package com.graffiti.page;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A persisted notebook page belonging to a collaborative room. */
@Entity
@Table(name = "room_pages", indexes = @Index(name = "idx_room_pages_room_order", columnList = "room_id,page_order"))
public class Page {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "room_id", nullable = false) private UUID roomId;
    @Column(nullable = false) private String title = "Canvas";
    @Column(nullable = false) private String template = "grid";
    @Column(name = "page_order", nullable = false) private int pageOrder;
    @Column(nullable = false) private boolean deleted;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    public Page() { }
    public Page(UUID roomId, String title, String template, int pageOrder) {
        this.roomId = roomId; this.title = title; this.template = template; this.pageOrder = pageOrder;
    }
    @PrePersist void beforeInsert() { createdAt = createdAt == null ? Instant.now() : createdAt; updatedAt = Instant.now(); }
    @PreUpdate void beforeUpdate() { updatedAt = Instant.now(); }
    public UUID getId() { return id; } public UUID getRoomId() { return roomId; }
    public String getTitle() { return title; } public void setTitle(String title) { this.title = title; }
    public String getTemplate() { return template; } public void setTemplate(String template) { this.template = template; }
    public int getPageOrder() { return pageOrder; } public void setPageOrder(int pageOrder) { this.pageOrder = pageOrder; }
    public boolean isDeleted() { return deleted; } public void setDeleted(boolean deleted) { this.deleted = deleted; }
    public Instant getCreatedAt() { return createdAt; } public Instant getUpdatedAt() { return updatedAt; }
}
