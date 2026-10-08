package com.graffiti.user;

import com.graffiti.security.desktop.DesktopHandoffService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * REST Controller exposing user authentication and profile endpoints.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserService userService;
    private final DesktopHandoffService desktopHandoffService;

    public AuthController(UserService userService, DesktopHandoffService desktopHandoffService) {
        this.userService = userService;
        this.desktopHandoffService = desktopHandoffService;
    }

    /**
     * Issues a one-time 60s desktop handoff code for an authenticated user.
     */
    @PostMapping("/desktop-handoff/issue")
    public ResponseEntity<Map<String, String>> issueDesktopHandoffCode(
            @AuthenticationPrincipal UUID principal,
            @RequestBody(required = false) Map<String, String> body) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        String deviceId = body != null ? body.get("deviceId") : null;
        String deviceLabel = body != null ? body.get("deviceLabel") : "Graffiti Desktop";
        String code = desktopHandoffService.issueCode(principal, deviceId, deviceLabel);
        return ResponseEntity.ok(Map.of("code", code));
    }

    /**
     * Exchanges a one-time 60s desktop handoff code for a JWT token and user profile.
     * Public endpoint called by desktop app.
     */
    @PostMapping("/desktop-handoff/exchange")
    public ResponseEntity<AuthResponse> exchangeDesktopHandoffCode(
            @RequestBody Map<String, String> body) {
        String code = body != null ? body.get("code") : null;
        AuthResponse response = desktopHandoffService.exchangeCode(code);
        return ResponseEntity.ok(response);
    }

    /**
     * Polls the status of an active desktop login session.
     */
    @GetMapping("/desktop-handoff/poll")
    public ResponseEntity<Map<String, Object>> pollDesktopSession(@RequestParam("session") String session) {
        String code = desktopHandoffService.pollSession(session);
        if (code != null) {
            return ResponseEntity.ok(Map.of("status", "READY", "code", code));
        }
        return ResponseEntity.ok(Map.of("status", "PENDING"));
    }

    /**
     * Completes an active desktop login session after browser authentication.
     */
    @PostMapping("/desktop-handoff/complete")
    public ResponseEntity<Map<String, Object>> completeDesktopSession(@RequestBody Map<String, String> body) {
        String session = body != null ? body.get("session") : null;
        String code = body != null ? body.get("code") : null;
        boolean ok = desktopHandoffService.completeSession(session, code);
        return ResponseEntity.ok(Map.of("success", ok));
    }

    /**
     * Register a new user account with email, password, and optional name.
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        AuthResponse response = userService.register(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Login with email and password.
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        AuthResponse response = userService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@AuthenticationPrincipal UUID principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(userService.refresh(principal));
    }

    /**
     * Fetch the currently authenticated user's profile.
     * Used by frontend on app load to validate JWT and hydrate user state.
     */
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getProfile(@AuthenticationPrincipal UUID principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        UserProfileResponse profile = userService.getProfile(principal);
        return ResponseEntity.ok(profile);
    }

    /**
     * Update the authenticated user's profile (name, avatarUrl).
     */
    @PatchMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @AuthenticationPrincipal UUID principal,
            @RequestBody UpdateProfileRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        UserProfileResponse updated = userService.updateProfile(principal, request);
        return ResponseEntity.ok(updated);
    }
}
