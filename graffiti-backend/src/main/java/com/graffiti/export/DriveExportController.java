package com.graffiti.export;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Controller for Google Drive canvas export, importing, folder browsing, and multi-account management.
 * Separates Google Drive storage from user credentials, enabling guest tokens or multiple connected Drive accounts.
 */
@RestController
@RequestMapping("/export")
public class DriveExportController {

    private final GoogleDriveService drive;
    private final com.graffiti.security.JwtTokenProvider tokenProvider;

    public DriveExportController(GoogleDriveService drive, com.graffiti.security.JwtTokenProvider tokenProvider) {
        this.drive = drive;
        this.tokenProvider = tokenProvider;
    }

    public record AddDriveAccountRequest(String accountEmail, String accountLabel, String accessToken, String refreshToken, boolean isDefault) {}

    @GetMapping("/drive/accounts")
    public ResponseEntity<List<ConnectedDriveAccount>> getConnectedAccounts(@AuthenticationPrincipal UUID userId) {
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(drive.getConnectedAccounts(userId));
    }

    @PostMapping("/drive/accounts")
    public ResponseEntity<ConnectedDriveAccount> connectAccount(@AuthenticationPrincipal UUID userId,
                                                                @RequestBody AddDriveAccountRequest req) {
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        if (req.accountEmail == null || req.accessToken == null) {
            return ResponseEntity.badRequest().build();
        }
        ConnectedDriveAccount acc = drive.addConnectedAccount(
                userId, req.accountEmail, req.accountLabel, req.accessToken, req.refreshToken, req.isDefault
        );
        return ResponseEntity.ok(acc);
    }

    @DeleteMapping("/drive/accounts/{id}")
    public ResponseEntity<Void> disconnectAccount(@AuthenticationPrincipal UUID userId,
                                                  @PathVariable UUID id) {
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        drive.removeConnectedAccount(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/drive/oauth/authorize")
    public Object authorizeOAuth(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(value = "userId", required = false) UUID paramUserId,
            @RequestParam(value = "token", required = false) String tokenParam,
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "format", required = false) String format,
            HttpServletRequest request) {

        UUID effectiveUserId = userId;
        if (effectiveUserId == null && org.springframework.util.StringUtils.hasText(tokenParam) && tokenProvider.validateToken(tokenParam)) {
            effectiveUserId = tokenProvider.getUserIdFromToken(tokenParam);
        }
        if (effectiveUserId == null) {
            effectiveUserId = paramUserId;
        }
        if (effectiveUserId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Sign in before connecting a Google Drive account."));
        }

        String redirectUri = resolveDriveCallbackUri(request);
        String state = effectiveUserId + ":" + (from != null ? from : "web") + ":" + UUID.randomUUID();
        String authUrl = drive.buildOAuthUrl(redirectUri, state);

        if ("json".equalsIgnoreCase(format)) {
            return ResponseEntity.ok(Map.of("authorizationUrl", authUrl));
        }

        return ResponseEntity.status(302).location(java.net.URI.create(authUrl)).build();
    }

    @GetMapping("/drive/oauth/callback")
    public ResponseEntity<String> oAuthCallback(
            @RequestParam("code") String code,
            @RequestParam(value = "state", required = false) String state,
            HttpServletRequest request) {

        String redirectUri = resolveDriveCallbackUri(request);
        try {
            UUID userId = null;
            if (state != null && state.contains(":")) {
                userId = UUID.fromString(state.split(":")[0]);
            }
            if (userId == null) {
                return ResponseEntity.badRequest().body("<html><body>Invalid state parameter</body></html>");
            }

            drive.exchangeOAuthCodeAndConnect(userId, code, redirectUri);

            String html = """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Google Drive Connected</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            margin: 0;
                            background: #09090b;
                            color: #ffffff;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                        }
                        .card {
                            max-width: 440px;
                            width: 90%;
                            background: #121215;
                            border: 1px solid #27272a;
                            border-radius: 16px;
                            padding: 40px 32px;
                            text-align: center;
                            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
                        }
                        .icon {
                            width: 60px;
                            height: 60px;
                            background: rgba(34, 197, 94, 0.12);
                            border: 1px solid rgba(34, 197, 94, 0.25);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0 auto 20px;
                            color: #22c55e;
                        }
                        h2 {
                            margin: 0 0 10px;
                            font-size: 20px;
                            font-weight: 600;
                            color: #fafafa;
                        }
                        p {
                            color: #a1a1aa;
                            font-size: 14px;
                            line-height: 1.5;
                            margin: 0 0 24px;
                        }
                        .btn {
                            display: inline-block;
                            background: #d4a359;
                            color: #09090b;
                            font-weight: 600;
                            font-size: 14px;
                            padding: 10px 24px;
                            border-radius: 8px;
                            border: none;
                            cursor: pointer;
                            text-decoration: none;
                            transition: opacity 0.15s;
                        }
                        .btn:hover {
                            opacity: 0.9;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <h2>Google Drive Connected</h2>
                        <p>Your Google Drive account has been connected successfully. You can close this tab and return to Graffiti.</p>
                        <button class="btn" onclick="window.close()">Close Tab</button>
                    </div>
                    <script>
                        try {
                            localStorage.setItem('graffiti:drive_connected', Date.now().toString());
                        } catch(e) {}
                        try {
                            const bc = new BroadcastChannel('graffiti_drive_channel');
                            bc.postMessage({ type: 'GRAFFITI_DRIVE_CONNECTED' });
                            bc.close();
                        } catch(e) {}
                        if (window.opener) {
                            try { window.opener.postMessage({ type: 'GRAFFITI_DRIVE_CONNECTED' }, '*'); } catch(e) {}
                        }
                        setTimeout(function() {
                            window.close();
                        }, 600);
                    </script>
                </body>
                </html>
                """;
            return ResponseEntity.ok().header("Content-Type", "text/html").body(html);
        } catch (Exception e) {
            String errHtml = """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Connection Failed</title>
                    <style>
                        body { margin: 0; background: #09090b; color: #ffffff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
                        .card { max-width: 440px; width: 90%; background: #121215; border: 1px solid #ef4444; border-radius: 16px; padding: 36px 28px; text-align: center; }
                        h2 { color: #ef4444; margin-top: 0; }
                        p { color: #a1a1aa; font-size: 14px; line-height: 1.5; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>Connection Failed</h2>
                        <p>%s</p>
                    </div>
                </body>
                </html>
                """.formatted(e.getMessage() != null ? e.getMessage() : "Unknown error");
            return ResponseEntity.status(500).header("Content-Type", "text/html").body(errHtml);
        }
    }

    private String resolveDriveCallbackUri(HttpServletRequest request) {
        String host = request.getHeader("X-Forwarded-Host");
        if (host == null || host.isBlank()) {
            host = request.getHeader("Host");
        }
        if (host != null && host.contains("ankitarsh.me")) {
            return "https://api-graffiti.ankitarsh.me/export/drive/oauth/callback";
        }
        return "https://api-graffiti.ankitarsh.me/export/drive/oauth/callback";
    }

    /**
     * Lists user's Google Drive folders for destination selection.
     */
    @GetMapping("/drive/folders")
    public ResponseEntity<List<Map<String, Object>>> listFolders(
            @AuthenticationPrincipal UUID userId,
            @RequestHeader(value = "X-Google-Drive-Token", required = false) String directToken,
            @RequestParam(value = "accountId", required = false) UUID accountId,
            @RequestParam(value = "parentFolderId", required = false) String parentFolderId,
            @RequestParam(value = "search", required = false) String search) {
        return ResponseEntity.ok(drive.listFolders(userId, accountId, directToken, parentFolderId, search));
    }

    /**
     * Lists user's Google Drive files for importing onto canvas.
     */
    @GetMapping("/drive/files")
    public ResponseEntity<List<Map<String, Object>>> listFiles(
            @AuthenticationPrincipal UUID userId,
            @RequestHeader(value = "X-Google-Drive-Token", required = false) String directToken,
            @RequestParam(value = "accountId", required = false) UUID accountId,
            @RequestParam(value = "folderId", required = false) String folderId,
            @RequestParam(value = "search", required = false) String search) {
        return ResponseEntity.ok(drive.listFiles(userId, accountId, directToken, folderId, search));
    }

    /**
     * Downloads a file from Google Drive for canvas importing.
     */
    @GetMapping("/drive/files/{fileId}/download")
    public ResponseEntity<byte[]> downloadFile(
            @AuthenticationPrincipal UUID userId,
            @RequestHeader(value = "X-Google-Drive-Token", required = false) String directToken,
            @RequestParam(value = "accountId", required = false) UUID accountId,
            @PathVariable("fileId") String fileId) {
        GoogleDriveService.DownloadedDriveFile file = drive.downloadFile(userId, accountId, directToken, fileId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.mimeType() != null ? file.mimeType() : "application/octet-stream"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.name() + "\"")
                .body(file.content());
    }

    /**
     * Uploads a canvas PDF to Google Drive, optionally to a specific folder.
     */
    @PostMapping("/drive")
    public ResponseEntity<Map<String, Object>> upload(
            @AuthenticationPrincipal UUID userId,
            @RequestHeader(value = "X-Google-Drive-Token", required = false) String directToken,
            @RequestParam(value = "accountId", required = false) UUID accountId,
            @RequestParam(value = "folderId", required = false) String folderId,
            @RequestParam("file") MultipartFile file) throws IOException {

        if (file.isEmpty() || !"application/pdf".equalsIgnoreCase(file.getContentType())) {
            return ResponseEntity.badRequest().build();
        }

        if (userId == null && (directToken == null || directToken.isBlank())) {
            return ResponseEntity.status(401).body(Map.of("error", "Sign in or provide a Google Drive access token to export to Drive."));
        }

        String filename = file.getOriginalFilename() == null ? "graffiti-board.pdf" : file.getOriginalFilename();
        Map<String, Object> result = drive.uploadPdf(userId, accountId, directToken, file.getBytes(), filename, folderId);
        return ResponseEntity.ok(result);
    }
}
