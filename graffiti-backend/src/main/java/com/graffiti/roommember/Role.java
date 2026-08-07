package com.graffiti.roommember;

/**
 * Enumeration defining access roles for claimed whiteboard rooms.
 *
 * OWNER: Full admin control over room configuration and membership.
 * EDITOR: Full read and write permissions to add, edit, or delete shapes.
 * VIEWER: Read-only access to view canvas state and stream presence.
 */
public enum Role {
    OWNER,
    EDITOR,
    VIEWER
}
