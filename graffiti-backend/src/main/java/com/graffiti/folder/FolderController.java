package com.graffiti.folder;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class FolderController {

    private final FolderRepository folderRepository;

    public FolderController(FolderRepository folderRepository) {
        this.folderRepository = folderRepository;
    }

    @GetMapping("/workspaces/{workspaceId}/folders")
    public ResponseEntity<List<Folder>> listFolders(@PathVariable("workspaceId") UUID workspaceId) {
        List<Folder> folders = folderRepository.findByWorkspaceId(workspaceId);
        return ResponseEntity.ok(folders);
    }

    @PostMapping("/workspaces/{workspaceId}/folders")
    public ResponseEntity<Folder> createFolder(@PathVariable("workspaceId") UUID workspaceId,
                                               @RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "New Folder");
        String color = body.getOrDefault("color", "#4dabf7");
        String parentFolderIdStr = body.get("parentFolderId");
        UUID parentFolderId = parentFolderIdStr != null && !parentFolderIdStr.isBlank()
                ? UUID.fromString(parentFolderIdStr)
                : null;

        Folder folder = new Folder(workspaceId, parentFolderId, name, color);
        Folder saved = folderRepository.save(folder);
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/folders/{id}")
    public ResponseEntity<Folder> updateFolder(@PathVariable("id") UUID id,
                                               @RequestBody Map<String, String> body) {
        return folderRepository.findById(id).map(f -> {
            if (body.containsKey("name")) f.setName(body.get("name"));
            if (body.containsKey("color")) f.setColor(body.get("color"));
            if (body.containsKey("parentFolderId")) {
                String p = body.get("parentFolderId");
                f.setParentFolderId(p != null && !p.isBlank() ? UUID.fromString(p) : null);
            }
            return ResponseEntity.ok(folderRepository.save(f));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/folders/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable("id") UUID id) {
        folderRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
