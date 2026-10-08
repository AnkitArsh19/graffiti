package com.graffiti.email;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Implementation of EmailService supporting Resend, Brevo, and safe console fallback.
 * Employs responsive HTML email templates with native Dark Mode & Light Mode support.
 */
@Service
public class EmailServiceImpl implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailServiceImpl.class);

    @Value("${app.email.provider:resend}")
    private String provider;

    @Value("${app.email.api-key:}")
    private String apiKey;

    @Value("${app.email.from:Graffiti <notifications@graffiti.ankitarsh.me>}")
    private String fromEmail;

    @Value("${app.email.frontend-url:https://graffiti.ankitarsh.me}")
    private String frontendUrl;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public EmailServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public void sendRoomInviteEmail(String toEmail, String inviterNameOrEmail, String roomName, String roomSlug, String role) {
        String cleanBase = (frontendUrl != null && !frontendUrl.isBlank())
                ? frontendUrl.replaceAll("/+$", "")
                : "https://graffiti.ankitarsh.me";
        String roomUrl = cleanBase + "/room/" + roomSlug;
        String subject = (inviterNameOrEmail != null && !inviterNameOrEmail.isBlank())
                ? inviterNameOrEmail + " invited you to collaborate on Graffiti"
                : "You've been invited to collaborate on Graffiti";

        String htmlContent = buildInviteTemplate(inviterNameOrEmail, roomName, roomUrl, role);

        if (apiKey == null || apiKey.trim().isEmpty()) {
            log.info("[EmailService] No app.email.api-key configured. Simulated dispatch to <{}> for room '{}' ({}) via {}",
                    toEmail, roomName, roomUrl, roomUrl);
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                if ("brevo".equalsIgnoreCase(provider)) {
                    sendViaBrevo(toEmail, subject, htmlContent);
                } else {
                    sendViaResend(toEmail, subject, htmlContent);
                }
            } catch (Exception ex) {
                log.error("[EmailService] Failed to dispatch invite email to {}: {}", toEmail, ex.getMessage());
            }
        });
    }

    private void sendViaResend(String toEmail, String subject, String htmlContent) throws Exception {
        Map<String, Object> payload = Map.of(
                "from", fromEmail,
                "to", List.of(toEmail),
                "subject", subject,
                "html", htmlContent
        );

        String json = objectMapper.writeValueAsString(payload);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.resend.com/emails"))
                .header("Authorization", "Bearer " + apiKey.trim())
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            log.info("[EmailService-Resend] Invitation email successfully sent to {}", toEmail);
        } else {
            log.warn("[EmailService-Resend] Failed with status {}: {}", response.statusCode(), response.body());
        }
    }

    private void sendViaBrevo(String toEmail, String subject, String htmlContent) throws Exception {
        Map<String, Object> payload = Map.of(
                "sender", Map.of("name", "Graffiti", "email", extractPureEmail(fromEmail)),
                "to", List.of(Map.of("email", toEmail)),
                "subject", subject,
                "htmlContent", htmlContent
        );

        String json = objectMapper.writeValueAsString(payload);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                .header("api-key", apiKey.trim())
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            log.info("[EmailService-Brevo] Invitation email successfully dispatched to {} from sender {}. Brevo response: {}",
                    toEmail, extractPureEmail(fromEmail), response.body());
        } else {
            log.warn("[EmailService-Brevo] Failed with status {}: {}", response.statusCode(), response.body());
        }
    }

    private String extractPureEmail(String fullFrom) {
        if (fullFrom.contains("<") && fullFrom.contains(">")) {
            return fullFrom.substring(fullFrom.indexOf("<") + 1, fullFrom.indexOf(">")).trim();
        }
        return fullFrom.trim();
    }

    /**
     * Builds a luxury, responsive HTML email matching the Graffiti design tokens.
     * Features full Dark Mode / Light Mode support with zero emojis, solid surfaces,
     * and high-contrast golden accent call-to-actions.
     */
    private String buildInviteTemplate(String inviter, String roomName, String roomUrl, String role) {
        String cleanBase = (frontendUrl != null && !frontendUrl.isBlank())
                ? frontendUrl.replaceAll("/+$", "")
                : "https://graffiti.ankitarsh.me";
        String displayInviter = (inviter != null && !inviter.isBlank()) ? inviter : "A teammate";
        String displayRoom = (roomName != null && !roomName.isBlank()) ? roomName : "Untitled Whiteboard";
        String displayRole = (role != null && !role.isBlank()) ? role.toUpperCase() : "EDITOR";

        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light dark">
          <meta name="supported-color-schemes" content="light dark">
          <title>Graffiti Whiteboard Invitation</title>
          <style>
            :root {
              color-scheme: light dark;
              supported-color-schemes: light dark;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: #09090b;
              color: #f4f4f5;
              -webkit-font-smoothing: antialiased;
            }
            .email-container {
              width: 100%%;
              max-width: 560px;
              margin: 40px auto;
              background-color: #121214;
              border: 1px solid #27272a;
              border-radius: 14px;
              overflow: hidden;
            }
            .email-header {
              padding: 32px 36px 20px;
              border-bottom: 1px solid #27272a;
            }
            .brand-name {
              font-size: 18px;
              font-weight: 700;
              letter-spacing: 1px;
              color: #f4f4f5;
              text-transform: uppercase;
              margin: 0 0 4px;
            }
            .brand-subtitle {
              font-size: 12px;
              color: #71717a;
              margin: 0;
            }
            .email-body {
              padding: 32px 36px;
            }
            .headline {
              font-size: 20px;
              font-weight: 600;
              color: #f4f4f5;
              margin: 0 0 16px;
              line-height: 1.35;
            }
            .intro-text {
              font-size: 14px;
              line-height: 1.6;
              color: #a1a1aa;
              margin: 0 0 24px;
            }
            .details-box {
              background-color: #18181b;
              border: 1px solid #27272a;
              border-radius: 10px;
              padding: 18px 20px;
              margin-bottom: 28px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              padding: 6px 0;
            }
            .detail-label {
              color: #71717a;
              font-weight: 500;
            }
            .detail-value {
              color: #f4f4f5;
              font-weight: 600;
              text-align: right;
            }
            .role-badge {
              display: inline-block;
              background-color: rgba(212, 163, 89, 0.15);
              color: #d4a359;
              font-size: 11px;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              letter-spacing: 0.5px;
            }
            .cta-container {
              text-align: center;
              margin: 32px 0 24px;
            }
            .cta-btn {
              display: inline-block;
              background-color: #d4a359;
              color: #09090b !important;
              font-size: 14px;
              font-weight: 700;
              text-decoration: none;
              padding: 13px 32px;
              border-radius: 8px;
              letter-spacing: 0.2px;
            }
            .url-fallback {
              font-size: 12px;
              line-height: 1.5;
              color: #71717a;
              word-break: break-all;
              margin: 20px 0 0;
            }
            .url-link {
              color: #d4a359;
              text-decoration: none;
            }
            .email-footer {
              padding: 24px 36px;
              border-top: 1px solid #27272a;
              font-size: 11px;
              color: #71717a;
              line-height: 1.5;
              text-align: center;
            }

            /* Light mode overrides for email clients that support it */
            @media (prefers-color-scheme: light) {
              body {
                background-color: #ffffff !important;
                color: #18181b !important;
              }
              .email-container {
                background-color: #f4f4f5 !important;
                border-color: #e4e4e7 !important;
              }
              .email-header {
                border-bottom-color: #e4e4e7 !important;
              }
              .brand-name, .headline, .detail-value {
                color: #18181b !important;
              }
              .intro-text {
                color: #52525b !important;
              }
              .details-box {
                background-color: #ffffff !important;
                border-color: #e4e4e7 !important;
              }
              .detail-label, .brand-subtitle, .url-fallback, .email-footer {
                color: #71717a !important;
              }
              .role-badge {
                background-color: rgba(180, 123, 24, 0.12) !important;
                color: #b47b18 !important;
              }
              .cta-btn {
                background-color: #b47b18 !important;
                color: #ffffff !important;
              }
              .url-link {
                color: #b47b18 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1 class="brand-name">GRAFFITI</h1>
              <p class="brand-subtitle">Collaborative Visual Workspace</p>
            </div>
            <div class="email-body">
              <h2 class="headline">You're invited to collaborate</h2>
              <p class="intro-text">
                <strong>%s</strong> has invited you to collaborate in real time on a whiteboard canvas in Graffiti.
              </p>
              <div class="details-box">
                <table style="width: 100%%; border-collapse: collapse;">
                  <tr>
                    <td class="detail-label" style="padding: 6px 0;">Whiteboard</td>
                    <td class="detail-value" style="padding: 6px 0; text-align: right;">%s</td>
                  </tr>
                  <tr>
                    <td class="detail-label" style="padding: 6px 0;">Invited By</td>
                    <td class="detail-value" style="padding: 6px 0; text-align: right;">%s</td>
                  </tr>
                  <tr>
                    <td class="detail-label" style="padding: 6px 0;">Access Level</td>
                    <td class="detail-value" style="padding: 6px 0; text-align: right;">
                      <span class="role-badge">[%s]</span>
                    </td>
                  </tr>
                </table>
              </div>

              <div class="cta-container">
                <a href="%s" class="cta-btn" target="_blank" rel="noopener noreferrer">
                  Open Whiteboard
                </a>
              </div>

              <p class="url-fallback">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="%s" class="url-link">%s</a>
              </p>
            </div>
            <div class="email-footer">
              This invitation was sent from Graffiti via <strong>%s</strong>.<br>
              If you were not expecting this invitation, you can safely ignore this message.
            </div>
          </div>
        </body>
        </html>
        """.formatted(
                displayInviter,
                displayRoom,
                displayInviter,
                displayRole,
                roomUrl,
                roomUrl,
                roomUrl,
                cleanBase
        );
    }
}
