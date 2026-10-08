package com.graffiti.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.junit.jupiter.api.Assertions.*;

class CookieOAuth2AuthorizationRequestRepositoryTest {

    private final CookieOAuth2AuthorizationRequestRepository repository = new CookieOAuth2AuthorizationRequestRepository();

    @Test
    @DisplayName("Saves and loads OAuth2 authorization request using HttpOnly SameSite=Lax cookie")
    void savesAndLoadsAuthorizationRequest() {
        OAuth2AuthorizationRequest authRequest = OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("test-client-id")
                .redirectUri("https://api-graffiti.ankitarsh.me/login/oauth2/code/google")
                .state("test-state-123")
                .build();

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(authRequest, request, response);

        String setCookieHeader = response.getHeader("Set-Cookie");
        assertNotNull(setCookieHeader, "Set-Cookie header must be present");
        assertTrue(setCookieHeader.contains(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME));
        assertTrue(setCookieHeader.contains("HttpOnly"));
        assertTrue(setCookieHeader.contains("SameSite=Lax"));

        // Now simulate request returning from Google with that cookie
        jakarta.servlet.http.Cookie cookie = response.getCookie(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME);
        assertNotNull(cookie);

        MockHttpServletRequest callbackRequest = new MockHttpServletRequest();
        callbackRequest.setCookies(cookie);

        OAuth2AuthorizationRequest loaded = repository.loadAuthorizationRequest(callbackRequest);
        assertNotNull(loaded, "Loaded authorization request must not be null");
        assertEquals("test-client-id", loaded.getClientId());
        assertEquals("test-state-123", loaded.getState());
        assertEquals("https://api-graffiti.ankitarsh.me/login/oauth2/code/google", loaded.getRedirectUri());
    }

    @Test
    @DisplayName("Removes cookie after authorization request is consumed")
    void removesAuthorizationRequest() {
        OAuth2AuthorizationRequest authRequest = OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("test-client-id")
                .redirectUri("https://api-graffiti.ankitarsh.me/login/oauth2/code/google")
                .state("test-state-456")
                .build();

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(authRequest, request, response);

        jakarta.servlet.http.Cookie cookie = response.getCookie(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME);
        assertNotNull(cookie);

        MockHttpServletRequest callbackRequest = new MockHttpServletRequest();
        callbackRequest.setCookies(cookie);
        MockHttpServletResponse callbackResponse = new MockHttpServletResponse();

        OAuth2AuthorizationRequest removed = repository.removeAuthorizationRequest(callbackRequest, callbackResponse);
        assertNotNull(removed);
        assertEquals("test-state-456", removed.getState());

        jakarta.servlet.http.Cookie clearedCookie = callbackResponse.getCookie(CookieOAuth2AuthorizationRequestRepository.COOKIE_NAME);
        assertNotNull(clearedCookie);
        assertEquals(0, clearedCookie.getMaxAge());
    }
}
