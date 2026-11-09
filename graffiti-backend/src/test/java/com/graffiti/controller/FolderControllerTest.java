package com.graffiti.controller;

import com.graffiti.folder.Folder;
import com.graffiti.folder.FolderController;
import com.graffiti.folder.FolderRepository;
import com.graffiti.workspace.Workspace;
import com.graffiti.workspace.WorkspaceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class FolderControllerTest {

    @Autowired
    private FolderController folderController;

    @Autowired
    private FolderRepository folderRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @BeforeEach
    void setUp() {
        folderRepository.deleteAll();
        workspaceRepository.deleteAll();
    }

    @Test
    void testListFolders_NonExistentWorkspace_ReturnsEmptyList() {
        UUID nonExistentWs = UUID.randomUUID();
        ResponseEntity<List<Folder>> response = folderController.listFolders(nonExistentWs, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().isEmpty());
    }

    @Test
    void testCreateFolder_NonExistentWorkspace_AutoResolvesWorkspaceAndSaves() {
        UUID nonExistentWs = UUID.randomUUID();
        UUID principal = UUID.randomUUID();

        ResponseEntity<Folder> response = folderController.createFolder(
                nonExistentWs,
                principal,
                Map.of("name", "Sprint Backlog", "color", "#ff6b6b")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Sprint Backlog", response.getBody().getName());
        assertEquals("#ff6b6b", response.getBody().getColor());

        // Verify that workspace was auto-provisioned to satisfy foreign key constraint
        assertNotEquals(nonExistentWs, response.getBody().getWorkspaceId());
        assertTrue(workspaceRepository.existsById(response.getBody().getWorkspaceId()));

        List<Folder> folders = folderRepository.findByWorkspaceId(response.getBody().getWorkspaceId());
        assertEquals(1, folders.size());
        assertEquals("Sprint Backlog", folders.get(0).getName());
    }

    @Test
    void testCreateFolder_ExistingWorkspace_Success() {
        UUID principal = UUID.randomUUID();
        Workspace ws = workspaceRepository.save(new Workspace("Engineering", principal, "Team workspace", "#4dabf7"));

        ResponseEntity<Folder> response = folderController.createFolder(
                ws.getId(),
                principal,
                Map.of("name", "Architecture", "color", "#51cf66")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(ws.getId(), response.getBody().getWorkspaceId());
        assertEquals("Architecture", response.getBody().getName());
    }
}

