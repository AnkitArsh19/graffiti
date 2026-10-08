package com.graffiti.room;

/**
 * Request DTO for updating room properties.
 */
public class UpdateRoomRequest {
    private String name;
    private Boolean isPublic;
    private java.util.UUID workspaceId;
    private java.util.UUID folderId;

    public UpdateRoomRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Boolean getIsPublic() { return isPublic; }
    public void setIsPublic(Boolean isPublic) { this.isPublic = isPublic; }
    public java.util.UUID getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(Object workspaceId) {
        if (workspaceId == null) {
            this.workspaceId = null;
        } else if (workspaceId instanceof java.util.UUID u) {
            this.workspaceId = u;
        } else {
            try {
                this.workspaceId = java.util.UUID.fromString(workspaceId.toString().trim());
            } catch (Exception e) {
                this.workspaceId = null;
            }
        }
    }
    public java.util.UUID getFolderId() { return folderId; }
    public void setFolderId(Object folderId) {
        if (folderId == null) {
            this.folderId = null;
        } else if (folderId instanceof java.util.UUID u) {
            this.folderId = u;
        } else {
            try {
                this.folderId = java.util.UUID.fromString(folderId.toString().trim());
            } catch (Exception e) {
                this.folderId = null;
            }
        }
    }
}
