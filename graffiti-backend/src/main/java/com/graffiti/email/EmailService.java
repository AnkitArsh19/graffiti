package com.graffiti.email;

/**
 * Service interface for sending transactional emails (room invitations, notifications).
 */
public interface EmailService {

    /**
     * Sends an email invitation to collaborate on a whiteboard room.
     *
     * @param toEmail            recipient email address
     * @param inviterNameOrEmail name or email of the user sending the invitation
     * @param roomName           human-readable name or title of the room/whiteboard
     * @param roomSlug           room slug identifier (used to construct the URL)
     * @param role               assigned role (EDITOR or VIEWER)
     */
    void sendRoomInviteEmail(String toEmail, String inviterNameOrEmail, String roomName, String roomSlug, String role);
}
