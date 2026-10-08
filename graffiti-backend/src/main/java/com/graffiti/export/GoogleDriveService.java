package com.graffiti.export;

import com.graffiti.user.User;
import com.graffiti.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.*;

/**
 * Handles Google Drive integration: uploading canvases, listing folders and files,
 * downloading files for import, multi-account management, and token refresh.
 */
@Service
public class GoogleDriveService {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveService.class);
    private static final String DRIVE_V3_BASE = "https://www.googleapis.com/drive/v3";

    private final UserRepository users;
    private final ConnectedDriveAccountRepository driveAccounts;
    private final boolean enabled;
    private final String clientId;
    private final String clientSecret;
    private final RestClient client;

    public record DownloadedDriveFile(String name, String mimeType, byte[] content) {}
    private record ResolvedToken(String token, ConnectedDriveAccount account) {}

    public GoogleDriveService(UserRepository users,
                              ConnectedDriveAccountRepository driveAccounts,
                              @Value("${app.drive.enabled:true}") boolean enabled,
                              @Value("${app.drive.client-id:}") String clientId,
                              @Value("${app.drive.client-secret:}") String clientSecret,
                              @Value("${app.aiml.timeout-ms:8000}") int timeout) {
        this.users = users;
        this.driveAccounts = driveAccounts;
        this.enabled = enabled;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);
        this.client = RestClient.builder().baseUrl("https://www.googleapis.com").requestFactory(factory).build();
    }

    public String buildOAuthUrl(String redirectUri, String state) {
        if (clientId == null || clientId.isBlank()) {
            throw new IllegalStateException("Google Drive Client ID is not configured in backend properties");
        }
        String scopes = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid";
        return "https://accounts.google.com/o/oauth2/v2/auth?"
                + "response_type=code"
                + "&client_id=" + java.net.URLEncoder.encode(clientId, java.nio.charset.StandardCharsets.UTF_8)
                + "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, java.nio.charset.StandardCharsets.UTF_8)
                + "&scope=" + java.net.URLEncoder.encode(scopes, java.nio.charset.StandardCharsets.UTF_8)
                + "&access_type=offline"
                + "&prompt=" + java.net.URLEncoder.encode("consent select_account", java.nio.charset.StandardCharsets.UTF_8)
                + "&state=" + java.net.URLEncoder.encode(state, java.nio.charset.StandardCharsets.UTF_8);
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public ConnectedDriveAccount exchangeOAuthCodeAndConnect(UUID userId, String code, String redirectUri) {
        if (userId == null) {
            throw new IllegalArgumentException("User must be authenticated to connect a Google Drive account");
        }
        MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
        tokenParams.add("code", code);
        tokenParams.add("client_id", clientId);
        tokenParams.add("client_secret", clientSecret);
        tokenParams.add("redirect_uri", redirectUri);
        tokenParams.add("grant_type", "authorization_code");

        RestClient tokenClient = RestClient.builder().baseUrl("https://oauth2.googleapis.com").build();
        Map<String, Object> tokenResp = tokenClient.post()
                .uri("/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(tokenParams)
                .retrieve()
                .body(Map.class);

        if (tokenResp == null || tokenResp.get("access_token") == null) {
            throw new IllegalStateException("Failed to retrieve access token from Google");
        }

        String accessToken = (String) tokenResp.get("access_token");
        String refreshToken = (String) tokenResp.get("refresh_token");

        // Fetch user email
        String email = "drive-user@gmail.com";
        try {
            Map<String, Object> userInfo = client.get()
                    .uri("/oauth2/v3/userinfo")
                    .headers(h -> h.setBearerAuth(accessToken))
                    .retrieve()
                    .body(Map.class);
            if (userInfo != null && userInfo.get("email") != null) {
                email = String.valueOf(userInfo.get("email"));
            }
        } catch (Exception ignored) {}

        String label = email.contains("@") ? email.split("@")[0] + " (Drive)" : "Google Drive";
        return addConnectedAccount(userId, email, label, accessToken, refreshToken, true);
    }

    @Transactional
    public List<ConnectedDriveAccount> getConnectedAccounts(UUID userId) {
        if (userId == null) {
            return List.of();
        }
        List<ConnectedDriveAccount> accounts = driveAccounts.findByUserIdOrderByCreatedAtAsc(userId);
        if (!accounts.isEmpty()) {
            return accounts;
        }
        // Auto-link primary Google account if user authenticated via Google OAuth
        Optional<User> userOpt = users.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getGoogleAccessToken() != null && !user.getGoogleAccessToken().isBlank()) {
                String email = user.getEmail();
                String label = (user.getName() != null && !user.getName().isBlank())
                        ? user.getName() + " (Google)"
                        : (email != null && email.contains("@") ? email.split("@")[0] + " (Google)" : "Google Drive");
                ConnectedDriveAccount autoAcc = addConnectedAccount(
                        userId, email, label, user.getGoogleAccessToken(), user.getGoogleRefreshToken(), true
                );
                return List.of(autoAcc);
            }
        }
        return List.of();
    }

    @Transactional
    public ConnectedDriveAccount addConnectedAccount(UUID userId, String email, String label, String accessToken, String refreshToken, boolean isDefault) {
        if (isDefault) {
            // Unmark existing defaults
            List<ConnectedDriveAccount> existing = driveAccounts.findByUserIdOrderByCreatedAtAsc(userId);
            for (ConnectedDriveAccount acc : existing) {
                if (acc.isDefault()) {
                    acc.setDefault(false);
                    driveAccounts.save(acc);
                }
            }
        }
        Optional<ConnectedDriveAccount> existingAcc = driveAccounts.findByUserIdAndAccountEmail(userId, email);
        if (existingAcc.isPresent()) {
            ConnectedDriveAccount acc = existingAcc.get();
            acc.setAccessToken(accessToken);
            if (refreshToken != null && !refreshToken.isBlank()) {
                acc.setRefreshToken(refreshToken);
            }
            if (label != null && !label.isBlank()) {
                acc.setAccountLabel(label);
            }
            if (isDefault) {
                acc.setDefault(true);
            }
            return driveAccounts.save(acc);
        }

        ConnectedDriveAccount newAcc = new ConnectedDriveAccount(userId, email, label, accessToken, refreshToken, isDefault);
        return driveAccounts.save(newAcc);
    }

    @Transactional
    public void removeConnectedAccount(UUID userId, UUID accountId) {
        driveAccounts.findByIdAndUserId(accountId, userId).ifPresent(driveAccounts::delete);
    }

    public String refreshAccessToken(ConnectedDriveAccount account) {
        if (account == null || account.getRefreshToken() == null || account.getRefreshToken().isBlank()) {
            return null;
        }
        try {
            MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
            tokenParams.add("client_id", clientId);
            tokenParams.add("client_secret", clientSecret);
            tokenParams.add("refresh_token", account.getRefreshToken());
            tokenParams.add("grant_type", "refresh_token");

            RestClient tokenClient = RestClient.builder().baseUrl("https://oauth2.googleapis.com").build();
            Map<String, Object> tokenResp = tokenClient.post()
                    .uri("/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(tokenParams)
                    .retrieve()
                    .body(Map.class);

            if (tokenResp != null && tokenResp.get("access_token") != null) {
                String newAccessToken = (String) tokenResp.get("access_token");
                account.setAccessToken(newAccessToken);
                driveAccounts.save(account);
                log.info("Successfully refreshed Google Drive access token for account {}", account.getAccountEmail());
                return newAccessToken;
            }
        } catch (Exception err) {
            log.warn("Failed to refresh Google Drive token for account {}: {}", account.getId(), err.getMessage());
        }
        return null;
    }

    private RuntimeException handleGoogleClientException(HttpClientErrorException e) {
        String body = e.getResponseBodyAsString();
        log.error("Google Drive API error (HTTP {}): {}", e.getStatusCode(), body);
        if (body != null && (body.contains("accessNotConfigured") || body.contains("Google Drive API has not been used in project") || body.contains("disabled"))) {
            return new IllegalArgumentException(
                "Google Drive API is not enabled in your Google Cloud Project (468366490568). " +
                "Please enable it by visiting: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=468366490568 " +
                "then retry in a few moments."
            );
        }
        if (e.getStatusCode().value() == 401) {
            return new IllegalArgumentException("Google Drive authentication token expired. Please reconnect your Google Drive account.");
        }
        if (e.getStatusCode().value() == 403) {
            return new IllegalArgumentException("Google Drive access denied. Ensure Google Drive permissions are granted.");
        }
        return new IllegalArgumentException("Google Drive error: " + (e.getMessage() != null ? e.getMessage() : "Unknown error"));
    }

    private ResolvedToken resolveToken(UUID userId, UUID accountId, String directToken) {
        if (directToken != null && !directToken.isBlank()) {
            return new ResolvedToken(directToken, null);
        }
        if (userId == null) {
            throw new IllegalArgumentException("User not authenticated and no Drive access token provided");
        }
        if (accountId != null) {
            ConnectedDriveAccount acc = driveAccounts.findByIdAndUserId(accountId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("Connected Drive account not found"));
            return new ResolvedToken(acc.getAccessToken(), acc);
        }
        List<ConnectedDriveAccount> accounts = driveAccounts.findByUserIdOrderByCreatedAtAsc(userId);
        if (!accounts.isEmpty()) {
            ConnectedDriveAccount target = accounts.stream().filter(ConnectedDriveAccount::isDefault).findFirst().orElse(accounts.get(0));
            return new ResolvedToken(target.getAccessToken(), target);
        }
        User user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getGoogleAccessToken() != null && !user.getGoogleAccessToken().isBlank()) {
            return new ResolvedToken(user.getGoogleAccessToken(), null);
        }
        throw new IllegalStateException("No Google Drive account connected. Please connect a Drive account in settings or provide an access token.");
    }

    /**
     * Lists folders in Google Drive for folder selection / hierarchy navigation.
     */
    public List<Map<String, Object>> listFolders(UUID userId, UUID accountId, String directToken, String parentFolderId) {
        return listFolders(userId, accountId, directToken, parentFolderId, null);
    }

    /**
     * Lists folders in Google Drive for folder selection / hierarchy navigation with search support.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listFolders(UUID userId, UUID accountId, String directToken, String parentFolderId, String search) {
        ResolvedToken resolved = resolveToken(userId, accountId, directToken);
        String token = resolved.token();
        try {
            return executeListFolders(token, parentFolderId, search);
        } catch (HttpClientErrorException.Unauthorized unauth) {
            if (resolved.account() != null) {
                String refreshed = refreshAccessToken(resolved.account());
                if (refreshed != null) {
                    try {
                        return executeListFolders(refreshed, parentFolderId, search);
                    } catch (HttpClientErrorException e) {
                        throw handleGoogleClientException(e);
                    }
                }
            }
            throw handleGoogleClientException(unauth);
        } catch (HttpClientErrorException e) {
            throw handleGoogleClientException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> executeListFolders(String accessToken, String parentFolderId, String search) {
        StringBuilder q = new StringBuilder("mimeType='application/vnd.google-apps.folder' and trashed=false");
        if (search != null && !search.isBlank()) {
            q.append(" and name contains '").append(search.replace("'", "\\'")).append("'");
        } else if (parentFolderId != null && !parentFolderId.isBlank()) {
            q.append(" and '").append(parentFolderId).append("' in parents");
        }

        Map<String, Object> resp = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/drive/v3/files")
                        .queryParam("q", q.toString())
                        .queryParam("pageSize", "100")
                        .queryParam("orderBy", "name")
                        .queryParam("fields", "nextPageToken,files(id,name,mimeType)")
                        .queryParam("supportsAllDrives", "true")
                        .queryParam("includeItemsFromAllDrives", "true")
                        .build())
                .headers(h -> h.setBearerAuth(accessToken))
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});

        List<Map<String, Object>> files = resp != null ? (List<Map<String, Object>>) resp.get("files") : null;
        return files != null ? files : List.of();
    }

    /**
     * Lists files in Google Drive for import. Supports searching and folder filtering.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listFiles(UUID userId, UUID accountId, String directToken, String folderId, String search) {
        ResolvedToken resolved = resolveToken(userId, accountId, directToken);
        String token = resolved.token();
        try {
            return executeListFiles(token, folderId, search);
        } catch (HttpClientErrorException.Unauthorized unauth) {
            if (resolved.account() != null) {
                String refreshed = refreshAccessToken(resolved.account());
                if (refreshed != null) {
                    try {
                        return executeListFiles(refreshed, folderId, search);
                    } catch (HttpClientErrorException e) {
                        throw handleGoogleClientException(e);
                    }
                }
            }
            throw handleGoogleClientException(unauth);
        } catch (HttpClientErrorException e) {
            throw handleGoogleClientException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> executeListFiles(String accessToken, String folderId, String search) {
        StringBuilder q = new StringBuilder("mimeType!='application/vnd.google-apps.folder' and trashed=false");
        if (search != null && !search.isBlank()) {
            q.append(" and name contains '").append(search.replace("'", "\\'")).append("'");
        } else if (folderId != null && !folderId.isBlank()) {
            q.append(" and '").append(folderId).append("' in parents");
        }

        Map<String, Object> resp = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/drive/v3/files")
                        .queryParam("q", q.toString())
                        .queryParam("pageSize", "100")
                        .queryParam("orderBy", "modifiedTime desc")
                        .queryParam("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)")
                        .queryParam("supportsAllDrives", "true")
                        .queryParam("includeItemsFromAllDrives", "true")
                        .build())
                .headers(h -> h.setBearerAuth(accessToken))
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});

        List<Map<String, Object>> files = resp != null ? (List<Map<String, Object>>) resp.get("files") : null;
        return files != null ? files : List.of();
    }

    /**
     * Downloads file contents from Google Drive for canvas importing.
     */
    public DownloadedDriveFile downloadFile(UUID userId, UUID accountId, String directToken, String fileId) {
        ResolvedToken resolved = resolveToken(userId, accountId, directToken);
        String token = resolved.token();
        try {
            return executeDownloadFile(token, fileId);
        } catch (HttpClientErrorException.Unauthorized unauth) {
            if (resolved.account() != null) {
                String refreshed = refreshAccessToken(resolved.account());
                if (refreshed != null) {
                    try {
                        return executeDownloadFile(refreshed, fileId);
                    } catch (HttpClientErrorException e) {
                        throw handleGoogleClientException(e);
                    }
                }
            }
            throw handleGoogleClientException(unauth);
        } catch (HttpClientErrorException e) {
            throw handleGoogleClientException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private DownloadedDriveFile executeDownloadFile(String accessToken, String fileId) {
        Map<String, Object> meta = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/drive/v3/files/{id}")
                        .queryParam("fields", "id,name,mimeType,size")
                        .queryParam("supportsAllDrives", "true")
                        .build(fileId))
                .headers(h -> h.setBearerAuth(accessToken))
                .retrieve()
                .body(Map.class);

        String name = (meta != null && meta.get("name") != null) ? meta.get("name").toString() : "drive-file";
        String mimeType = (meta != null && meta.get("mimeType") != null) ? meta.get("mimeType").toString() : "application/octet-stream";

        byte[] bytes = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/drive/v3/files/{id}")
                        .queryParam("alt", "media")
                        .queryParam("supportsAllDrives", "true")
                        .build(fileId))
                .headers(h -> h.setBearerAuth(accessToken))
                .retrieve()
                .body(byte[].class);

        return new DownloadedDriveFile(name, mimeType, bytes != null ? bytes : new byte[0]);
    }

    public Map<String, Object> uploadPdfWithToken(String accessToken, byte[] bytes, String filename) {
        return executeUploadPdf(accessToken, bytes, filename, null);
    }

    public Map<String, Object> uploadPdf(UUID userId, UUID accountId, String directToken, byte[] bytes, String filename) {
        return uploadPdf(userId, accountId, directToken, bytes, filename, null);
    }

    public Map<String, Object> uploadPdf(UUID userId, UUID accountId, String directToken, byte[] bytes, String filename, String folderId) {
        if (!enabled) {
            throw new IllegalStateException("Google Drive export is currently disabled in backend configuration");
        }
        ResolvedToken resolved = resolveToken(userId, accountId, directToken);
        String token = resolved.token();
        try {
            return executeUploadPdf(token, bytes, filename, folderId);
        } catch (HttpClientErrorException.Unauthorized unauth) {
            if (resolved.account() != null) {
                String refreshed = refreshAccessToken(resolved.account());
                if (refreshed != null) {
                    try {
                        return executeUploadPdf(refreshed, bytes, filename, folderId);
                    } catch (HttpClientErrorException e) {
                        throw handleGoogleClientException(e);
                    }
                }
            }
            throw handleGoogleClientException(unauth);
        } catch (HttpClientErrorException e) {
            throw handleGoogleClientException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeUploadPdf(String accessToken, byte[] bytes, String filename, String folderId) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("name", filename);
        metadata.put("mimeType", "application/pdf");
        if (folderId != null && !folderId.isBlank()) {
            metadata.put("parents", List.of(folderId));
        }
        body.add("metadata", metadata);
        body.add("file", new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        });

        Map<String, Object> result = client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/upload/drive/v3/files")
                        .queryParam("uploadType", "multipart")
                        .queryParam("fields", "id,name,webViewLink")
                        .queryParam("supportsAllDrives", "true")
                        .build())
                .headers(h -> h.setBearerAuth(accessToken))
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(Map.class);

        if (result == null || result.get("id") == null) {
            throw new IllegalStateException("Google Drive did not return a valid file ID");
        }

        String id = String.valueOf(result.get("id"));
        try {
            client.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/drive/v3/files/{id}/permissions")
                            .queryParam("supportsAllDrives", "true")
                            .build(id))
                    .headers(h -> h.setBearerAuth(accessToken))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("type", "anyone", "role", "reader"))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ignored) {
            // Permission sharing is best-effort
        }

        Map<String, Object> response = new HashMap<>(result);
        if (response.get("webViewLink") == null) {
            response.put("webViewLink", "https://drive.google.com/open?id=" + id);
        }
        return response;
    }
}
