package com.graffiti.folder;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "folders", indexes = {
    @Index(name = "idx_folders_workspace_parent", columnList = "workspace_id, parent_folder_id")
})
public class Folder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "parent_folder_id")
    private UUID parentFolderId;

    @Column(nullable = false)
    private String name;

    @Column(length = 32)
    private String color = "#4dabf7";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Folder() {
    }

    public Folder(UUID workspaceId, UUID parentFolderId, String name, String color) {
        this.workspaceId = workspaceId;
        this.parentFolderId = parentFolderId;
        this.name = name;
        this.color = color != null ? color : "#4dabf7";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        if (this.updatedAt == null) {
            this.updatedAt = Instant.now();
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getWorkspaceId() {
        return workspaceId;
    }

    public void setWorkspaceId(UUID workspaceId) {
        this.workspaceId = workspaceId;
    }

    public UUID getParentFolderId() {
        return parentFolderId;
    }

    public void setParentFolderId(UUID parentFolderId) {
        this.parentFolderId = parentFolderId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
