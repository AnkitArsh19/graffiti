package com.graffiti.security.desktop;

import com.graffiti.security.JwtTokenProvider;
import com.graffiti.user.AuthResponse;
import com.graffiti.user.User;
import com.graffiti.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Issues and redeems one-time desktop handoff codes (RFC 8252 pattern).
 *
 * The browser calls issueCode after the user logs in (or if already logged in).
 * The raw code is passed to /open-app?code=..., which fires graffiti://auth/callback?code=...
 * The desktop app calls exchangeCode to swap the code for a JWT token and user profile.
 */
@Service
public class DesktopHandoffService {

    private static final int CODE_TTL_SECONDS = 60;

    private final DesktopHandoffCodeRepository repository;
    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final SecureRandom secureRandom = new SecureRandom();

    public DesktopHandoffService(DesktopHandoffCodeRepository repository,
                                 UserRepository userRepository,
                                 JwtTokenProvider tokenProvider) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.tokenProvider = tokenProvider;
    }

    @Transactional
    public String issueCode(UUID userId, String deviceId, String deviceLabel) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String raw = randomCode();
        String hash = hashCode(raw);
        Instant now = Instant.now();

        DesktopHandoffCode code = new DesktopHandoffCode(
                UUID.randomUUID(), user, hash,
                now.plusSeconds(CODE_TTL_SECONDS),
                deviceId, deviceLabel);
        repository.save(code);
        return raw;
    }

    @Transactional
    public AuthResponse exchangeCode(String rawCode) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Handoff code is required");
        }

        String hash = hashCode(rawCode.trim());
        DesktopHandoffCode handoff = repository.findByCodeHash(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid handoff code"));

        if (handoff.getUsedAt() != null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Handoff code already redeemed");
        }
        if (handoff.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Handoff code expired");
        }

        // Mark as consumed immediately
        handoff.setUsedAt(Instant.now());
        repository.save(handoff);

        User user = handoff.getUser();
        String token = tokenProvider.generateToken(user.getId(), user.getEmail());

        return new AuthResponse(
                token,
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getAvatarUrl()
        );
    }

    public static class DesktopSessionState {
        private final String sessionId;
        private volatile String handoffCode;
        private final Instant expiresAt;

        public DesktopSessionState(String sessionId, Instant expiresAt) {
            this.sessionId = sessionId;
            this.expiresAt = expiresAt;
        }

        public boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }

        public String getHandoffCode() {
            return handoffCode;
        }

        public void setHandoffCode(String handoffCode) {
            this.handoffCode = handoffCode;
        }
    }

    private final java.util.concurrent.ConcurrentHashMap<String, DesktopSessionState> activeSessions =
            new java.util.concurrent.ConcurrentHashMap<>();

    public void registerSession(String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) {
            activeSessions.put(sessionId, new DesktopSessionState(sessionId, Instant.now().plusSeconds(300)));
        }
    }

    public boolean completeSession(String sessionId, String handoffCode) {
        if (sessionId == null || sessionId.isBlank() || handoffCode == null) return false;
        DesktopSessionState state = activeSessions.computeIfAbsent(
                sessionId, id -> new DesktopSessionState(id, Instant.now().plusSeconds(300))
        );
        if (state.isExpired()) return false;
        state.setHandoffCode(handoffCode);
        return true;
    }

    public String pollSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return null;
        DesktopSessionState state = activeSessions.get(sessionId);
        if (state == null || state.isExpired()) return null;
        return state.getHandoffCode();
    }

    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void cleanupExpiredCodes() {
        repository.deleteAllExpiredBefore(Instant.now());
        activeSessions.entrySet().removeIf(e -> e.getValue().isExpired());
    }

    private String randomCode() {
        byte[] buf = new byte[32];
        secureRandom.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    private String hashCode(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(md.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot hash handoff code", e);
        }
    }
}
