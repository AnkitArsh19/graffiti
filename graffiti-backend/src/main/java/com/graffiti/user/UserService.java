package com.graffiti.user;

import com.graffiti.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Service managing user registration, authentication, and profile operations.
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    /**
     * Registers a new user with email, name, and BCrypt-hashed password.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered: " + request.getEmail());
        }

        String encodedPassword = passwordEncoder.encode(request.getPassword());
        User user = new User(request.getEmail(), encodedPassword);
        user.setName(request.getName());
        userRepository.save(user);

        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getName(), user.getAvatarUrl());
    }

    /**
     * Authenticates an existing user by email and raw password.
     */
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Invalid email or password"));

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new org.springframework.security.authentication.BadCredentialsException("Invalid email or password");
        }

        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getName(), user.getAvatarUrl());
    }

    /** Issues a replacement access token for an already authenticated session. */
    public AuthResponse refresh(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("USER_NOT_FOUND", "User not found"));
        return new AuthResponse(tokenProvider.generateToken(user.getId(), user.getEmail()), user.getId(), user.getEmail(), user.getName(), user.getAvatarUrl());
    }

    /**
     * Fetches profile information for the currently authenticated user.
     */
    public UserProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("USER_NOT_FOUND", "User not found"));
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getName(), user.getAvatarUrl(), user.getProvider());
    }

    /**
     * Updates profile fields (name, avatarUrl) for an authenticated user.
     */
    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.graffiti.exception.ResourceNotFoundException("USER_NOT_FOUND", "User not found"));

        if (request.getName() != null) {
            user.setName(request.getName());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }
        userRepository.save(user);
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getName(), user.getAvatarUrl(), user.getProvider());
    }

    /**
     * Finds or creates a user from Google OAuth2 login data.
     * Links to existing local account if same email exists.
     */
    @Transactional
    public User findOrCreateGoogleUser(String email, String name, String avatarUrl, String googleId) {
        Optional<User> existingUser = userRepository.findByEmail(email);
        if (existingUser.isPresent()) {
            User user = existingUser.get();
            // Link Google OAuth identity to existing email account
            user.setGoogleId(googleId);
            if (user.getName() == null || user.getName().isBlank()) {
                user.setName(name);
            }
            if (user.getAvatarUrl() == null || user.getAvatarUrl().isBlank()) {
                user.setAvatarUrl(avatarUrl);
            }
            return userRepository.save(user);
        }

        User newUser = new User(email, name, avatarUrl, googleId);
        return userRepository.save(newUser);
    }

    @Transactional
    public void updateGoogleTokens(UUID userId, String accessToken, String refreshToken) {
        userRepository.findById(userId).ifPresent(user -> {
            if (accessToken != null) user.setGoogleAccessToken(accessToken);
            if (refreshToken != null) user.setGoogleRefreshToken(refreshToken);
            userRepository.save(user);
        });
    }
}
