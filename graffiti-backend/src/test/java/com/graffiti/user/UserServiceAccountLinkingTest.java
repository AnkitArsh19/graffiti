package com.graffiti.user;

import com.graffiti.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class UserServiceAccountLinkingTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider tokenProvider;
    private UserService userService;

    @BeforeEach
    void setUp() {
        userRepository = Mockito.mock(UserRepository.class);
        passwordEncoder = Mockito.mock(PasswordEncoder.class);
        tokenProvider = Mockito.mock(JwtTokenProvider.class);
        userService = new UserService(userRepository, passwordEncoder, tokenProvider);
    }

    @Test
    void testGoogleLoginLinksExistingLocalAccountWithSameEmail() {
        String email = "artist@graffiti.io";
        String existingPasswordHash = "$2a$10$hashedPasswordHere";
        User existingUser = new User(email, existingPasswordHash);
        existingUser.setId(UUID.randomUUID());
        existingUser.setName("Local Artist");

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(existingUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // When logging in with Google with same email
        User linkedUser = userService.findOrCreateGoogleUser(email, "Google Artist", "https://avatar.google.com/pic.png", "google-sub-12345");

        // Verify account is linked
        assertEquals(existingUser.getId(), linkedUser.getId());
        assertEquals("google-sub-12345", linkedUser.getGoogleId());
        assertEquals(existingPasswordHash, linkedUser.getPasswordHash(), "Password hash must be preserved for unified login");
        assertEquals("https://avatar.google.com/pic.png", linkedUser.getAvatarUrl());
        verify(userRepository).save(existingUser);
    }

    @Test
    void testGoogleLoginCreatesNewAccountWhenEmailDoesNotExist() {
        String email = "newuser@graffiti.io";
        when(userRepository.findByEmail(email)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User created = userService.findOrCreateGoogleUser(email, "New User", "https://avatar.png", "google-sub-999");

        assertEquals(email, created.getEmail());
        assertEquals("google-sub-999", created.getGoogleId());
        assertEquals(AuthProvider.GOOGLE, created.getProvider());
        verify(userRepository).save(any(User.class));
    }
}
