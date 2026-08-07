package com.graffiti.security;

import com.graffiti.user.User;
import com.graffiti.user.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/**
 * Authentication success handler for Google OAuth2 login flows.
 *
 * When a user successfully authenticates via Google OAuth2:
 * 1. Extracts the user's email address from Google OAuth2 claims.
 * 2. Checks if a User record exists in PostgreSQL; creates a new account if first-time login.
 * 3. Generates a signed JWT token via JwtTokenProvider.
 * 4. Redirects the client to /auth/oauth2/success with the JWT token as a query parameter.
 */
@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;

    public OAuth2SuccessHandler(UserRepository userRepository,
                                JwtTokenProvider tokenProvider,
                                @org.springframework.context.annotation.Lazy PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tokenProvider = tokenProvider;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");

        if (email == null) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Email not found from Google OAuth provider");
            return;
        }

        // Register new user account if logging in for the first time via Google OAuth2
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = new User(email, passwordEncoder.encode(UUID.randomUUID().toString()));
            return userRepository.save(newUser);
        });

        // Issue JWT bearer token for client SPA / mobile app
        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        String targetUrl = "/auth/oauth2/success?token=" + token + "&email=" + email;
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
