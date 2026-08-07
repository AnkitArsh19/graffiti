package com.graffiti.user;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller exposing user authentication endpoints (/auth/register, /auth/login).
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Endpoint to register a new user account.
     *
     * @param request RegisterRequest DTO containing email and password
     * @return ResponseEntity with AuthResponse DTO (token, userId, email)
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        AuthResponse response = userService.register(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint to login with email and password.
     *
     * @param request LoginRequest DTO containing email and password
     * @return ResponseEntity with AuthResponse DTO (token, userId, email)
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        AuthResponse response = userService.login(request);
        return ResponseEntity.ok(response);
    }
}
