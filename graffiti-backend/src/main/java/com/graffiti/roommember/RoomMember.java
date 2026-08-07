package com.graffiti.roommember;

import jakarta.persistence.*;
import java.util.UUID;

/**
 * JPA Entity mapping users to rooms with specific access roles (OWNER, EDITOR, VIEWER).
 */
@Entity
@Table(name = "room_members", uniqueConstraints = {
    @UniqueConstraint(name = "uk_room_user", columnNames = {"room_id", "user_id"})
})
public class RoomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    public RoomMember() {
    }

    public RoomMember(UUID roomId, UUID userId, Role role) {
        this.roomId = roomId;
        this.userId = userId;
        this.role = role;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }
}
