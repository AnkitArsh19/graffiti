package com.graffiti.security;

import com.graffiti.security.desktop.DesktopHandoffService;
import com.graffiti.user.User;
import com.graffiti.user.UserService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Authentication success handler for Google OAuth2 login flows.
 *
 * Extracts profile info from Google claims, finds or creates the user,
 * generates a JWT (or RFC 8252 60s desktop handoff code if launched from desktop),
 * and redirects the client accordingly.
 */
@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserService userService;
    private final JwtTokenProvider tokenProvider;
    private final DesktopHandoffService desktopHandoffService;
    private final ObjectProvider<OAuth2AuthorizedClientService> authorizedClientService;

    @Value("${app.oauth2.redirect-uri:http://localhost:5173/auth/oauth2/callback}")
    private String configuredRedirectUri;

    public OAuth2SuccessHandler(UserService userService,
                                JwtTokenProvider tokenProvider,
                                DesktopHandoffService desktopHandoffService,
                                ObjectProvider<OAuth2AuthorizedClientService> authorizedClientService) {
        this.userService = userService;
        this.tokenProvider = tokenProvider;
        this.desktopHandoffService = desktopHandoffService;
        this.authorizedClientService = authorizedClientService;
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

        String name = oAuth2User.getAttribute("name");
        String avatarUrl = oAuth2User.getAttribute("picture");
        String googleId = oAuth2User.getAttribute("sub");

        // Find existing user or create new one, linking Google profile data
        User user = userService.findOrCreateGoogleUser(email, name, avatarUrl, googleId);
        OAuth2AuthorizedClientService service = authorizedClientService.getIfAvailable();
        OAuth2AuthorizedClient client = service == null ? null : service.loadAuthorizedClient("google", authentication.getName());
        if (client != null) {
            userService.updateGoogleTokens(user.getId(), client.getAccessToken().getTokenValue(),
                    client.getRefreshToken() == null ? null : client.getRefreshToken().getTokenValue());
        }

        String fromVal = getFromValue(request);
        boolean isFromDesktop = fromVal != null && (fromVal.equalsIgnoreCase("desktop") || fromVal.startsWith("desktop:"));
        String frontendBase = resolveFrontendBase(request);

        clearFromCookie(response);

        if (isFromDesktop) {
            // Issue RFC 8252 one-time desktop handoff code
            String handoffCode = desktopHandoffService.issueCode(user.getId(), null, "Graffiti Desktop");
            String desktopSession = (fromVal != null && fromVal.startsWith("desktop:")) ? fromVal.substring("desktop:".length()) : null;
            if (desktopSession != null) {
                desktopHandoffService.completeSession(desktopSession, handoffCode);
            }
            String targetUrl = frontendBase + "/open-app?code=" + URLEncoder.encode(handoffCode, StandardCharsets.UTF_8);
            if (desktopSession != null) {
                targetUrl += "&session=" + URLEncoder.encode(desktopSession, StandardCharsets.UTF_8);
            }
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
            return;
        }

        // Standard web login - issue JWT bearer token
        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        String encodedEmail = URLEncoder.encode(email, StandardCharsets.UTF_8);
        String encodedName = (name != null) ? URLEncoder.encode(name, StandardCharsets.UTF_8) : "";

        String targetUrl = frontendBase + "/auth/oauth2/callback?token=" + token
                + "&email=" + encodedEmail
                + "&name=" + encodedName;

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    private String getFromValue(HttpServletRequest request) {
        String fromParam = request.getParameter("from");
        if (fromParam != null && !fromParam.isBlank()) {
            return fromParam;
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("graffiti_oauth_from".equals(cookie.getName()) || "graffiti_from_desktop".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private void clearFromCookie(HttpServletResponse response) {
        org.springframework.http.ResponseCookie cookie = org.springframework.http.ResponseCookie.from("graffiti_oauth_from", "")
                .path("/")
                .httpOnly(true)
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private String resolveFrontendBase(HttpServletRequest request) {
        String host = request.getHeader("X-Forwarded-Host");
        if (host == null || host.isBlank()) {
            host = request.getHeader("Host");
        }

        if (host != null && host.contains("ankitarsh.me")) {
            return "https://graffiti.ankitarsh.me";
        }

        // Fall back to configuredRedirectUri's base
        if (configuredRedirectUri != null && configuredRedirectUri.contains("/auth/oauth2/callback")) {
            return configuredRedirectUri.substring(0, configuredRedirectUri.indexOf("/auth/oauth2/callback"));
        }
        return "https://graffiti.ankitarsh.me";
    }
}
