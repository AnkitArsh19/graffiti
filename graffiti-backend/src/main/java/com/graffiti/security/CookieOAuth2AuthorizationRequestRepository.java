package com.graffiti.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import java.io.*;
import java.util.Base64;

/**
 * Stores the OAuth2 authorization request in an HttpOnly cookie instead of the server-side session.
 *
 * Essential for SessionCreationPolicy.STATELESS apps so OAuth2 authorization requests
 * survive the round-trip redirect to Google without requiring an HttpSession.
 */
@Component
public class CookieOAuth2AuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    public static final String COOKIE_NAME = "oauth2_auth_request";
    public static final String FROM_COOKIE_NAME = "graffiti_oauth_from";
    private static final int MAX_AGE_SECONDS = 300; // 5 minutes

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return getCookie(request);
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest,
                                         HttpServletRequest request,
                                         HttpServletResponse response) {
        if (authorizationRequest == null) {
            removeCookie(response);
            return;
        }
        String serialized = serialize(authorizationRequest);
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, serialized)
                .path("/")
                .httpOnly(true)
                .maxAge(MAX_AGE_SECONDS)
                .sameSite("Lax")
                .build();
        response.addHeader("Set-Cookie", cookie.toString());

        String from = request.getParameter("from");
        if (from != null && !from.isBlank()) {
            ResponseCookie fromCookie = ResponseCookie.from(FROM_COOKIE_NAME, from)
                    .path("/")
                    .httpOnly(true)
                    .maxAge(MAX_AGE_SECONDS)
                    .sameSite("Lax")
                    .build();
            response.addHeader("Set-Cookie", fromCookie.toString());
        }
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
                                                                  HttpServletResponse response) {
        OAuth2AuthorizationRequest req = loadAuthorizationRequest(request);
        removeCookie(response);
        return req;
    }

    private OAuth2AuthorizationRequest getCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName())) {
                try {
                    return deserialize(cookie.getValue());
                } catch (Exception e) {
                    return null;
                }
            }
        }
        return null;
    }

    private void removeCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
                .path("/")
                .httpOnly(true)
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private String serialize(OAuth2AuthorizationRequest request) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            oos.writeObject(request);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(baos.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException("Failed to serialize OAuth2AuthorizationRequest", e);
        }
    }

    private OAuth2AuthorizationRequest deserialize(String encoded) {
        byte[] bytes = Base64.getUrlDecoder().decode(encoded);
        try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(bytes))) {
            return (OAuth2AuthorizationRequest) ois.readObject();
        } catch (IOException | ClassNotFoundException e) {
            throw new IllegalStateException("Failed to deserialize OAuth2AuthorizationRequest", e);
        }
    }
}
