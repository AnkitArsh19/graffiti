package com.graffiti.export;

import com.graffiti.user.User;
import com.graffiti.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class GoogleDriveServiceTest {

    private UserRepository userRepository;
    private ConnectedDriveAccountRepository driveAccountRepository;
    private GoogleDriveService driveService;

    @BeforeEach
    void setUp() {
        userRepository = Mockito.mock(UserRepository.class);
        driveAccountRepository = Mockito.mock(ConnectedDriveAccountRepository.class);
        driveService = new GoogleDriveService(userRepository, driveAccountRepository, true, "test-client-id", "test-client-secret", 5000);
    }

    @Test
    void testAddAndListMultipleConnectedDriveAccounts() {
        UUID userId = UUID.randomUUID();

        ConnectedDriveAccount personal = new ConnectedDriveAccount(userId, "personal@gmail.com", "Personal Drive", "token_1", null, true);
        ConnectedDriveAccount work = new ConnectedDriveAccount(userId, "work@company.com", "Work Drive", "token_2", null, false);

        when(driveAccountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(personal, work));

        List<ConnectedDriveAccount> accounts = driveService.getConnectedAccounts(userId);

        assertEquals(2, accounts.size());
        assertEquals("personal@gmail.com", accounts.get(0).getAccountEmail());
        assertEquals("work@company.com", accounts.get(1).getAccountEmail());
        assertTrue(accounts.get(0).isDefault());
        assertFalse(accounts.get(1).isDefault());
    }

    @Test
    void testUploadPdfThrowsClearExceptionWhenNoAccountConnected() {
        UUID userId = UUID.randomUUID();
        User user = new User("user@graffiti.io", "hash");

        when(driveAccountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        Exception exception = assertThrows(IllegalStateException.class, () -> {
            driveService.uploadPdf(userId, null, null, new byte[]{1, 2, 3}, "test.pdf");
        });

        assertTrue(exception.getMessage().contains("No Google Drive account connected"));
    }

    @Test
    void testBuildOAuthUrlProducesValidUri() {
        String redirectUri = "https://api-graffiti.ankitarsh.me/export/drive/oauth/callback";
        String state = UUID.randomUUID() + ":desktop:" + UUID.randomUUID();

        String url = driveService.buildOAuthUrl(redirectUri, state);
        assertNotNull(url);
        // Verify URI.create does not throw IllegalArgumentException (due to spaces or illegal query characters)
        assertDoesNotThrow(() -> java.net.URI.create(url));
        assertTrue(url.contains("prompt="));
        assertFalse(url.contains(" "));
    }

    @Test
    void testAutoLinkPrimaryGoogleAccountWhenDriveAccountsEmpty() {
        UUID userId = UUID.randomUUID();
        User user = new User("ankit@gmail.com", "Ankit", "https://avatar.url", "google-sub-123");
        user.setGoogleAccessToken("google-access-token-xyz");

        when(driveAccountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(driveAccountRepository.findByUserIdAndAccountEmail(userId, "ankit@gmail.com")).thenReturn(Optional.empty());
        when(driveAccountRepository.save(any(ConnectedDriveAccount.class))).thenAnswer(inv -> inv.getArgument(0));

        List<ConnectedDriveAccount> accounts = driveService.getConnectedAccounts(userId);

        assertEquals(1, accounts.size());
        assertEquals("ankit@gmail.com", accounts.get(0).getAccountEmail());
        assertEquals("google-access-token-xyz", accounts.get(0).getAccessToken());
        assertTrue(accounts.get(0).isDefault());
    }
}
