package com.graffiti.export;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Represents a connected Google Drive account for exporting canvases.
 * Allows users to link multiple separate Drive accounts (personal, work, team).
 */
@Entity
@Table(name = "user_drive_accounts", indexes = {
    @Index(name = "idx_drive_user_id", columnList = "user_id")
})
public class ConnectedDriveAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "account_email", nullable = false)
    private String accountEmail;

    @Column(name = "account_label")
    private String accountLabel;

    @Column(name = "access_token", length = 4096, nullable = false)
    private String accessToken;

    @Column(name = "refresh_token", length = 4096)
    private String refreshToken;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public ConnectedDriveAccount() {
    }

    public ConnectedDriveAccount(UUID userId, String accountEmail, String accountLabel, String accessToken, String refreshToken, boolean isDefault) {
        this.userId = userId;
        this.accountEmail = accountEmail;
        this.accountLabel = accountLabel != null && !accountLabel.isBlank() ? accountLabel : accountEmail;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.isDefault = isDefault;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getAccountEmail() { return accountEmail; }
    public void setAccountEmail(String accountEmail) { this.accountEmail = accountEmail; }
    public String getAccountLabel() { return accountLabel; }
    public void setAccountLabel(String accountLabel) { this.accountLabel = accountLabel; }
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
