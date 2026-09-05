package com.graffiti.workspace;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/workspaces")
public class WorkspaceController {

    private final WorkspaceRepository workspaceRepository;

    public WorkspaceController(WorkspaceRepository workspaceRepository) {
        this.workspaceRepository = workspaceRepository;
    }

    @GetMapping
    public ResponseEntity<List<Workspace>> listWorkspaces(@AuthenticationPrincipal UUID principal) {
        if (principal != null) {
            List<Workspace> userWorkspaces = workspaceRepository.findByOwnerId(principal);
            return ResponseEntity.ok(userWorkspaces);
        }
        List<Workspace> publicWorkspaces = workspaceRepository.findByOwnerIdIsNull();
        return ResponseEntity.ok(publicWorkspaces);
    }

    @PostMapping
    public ResponseEntity<Workspace> createWorkspace(@RequestBody Map<String, String> body,
                                                     @AuthenticationPrincipal UUID principal) {
        String name = body.getOrDefault("name", "Untitled Workspace");
        String description = body.get("description");
        String color = body.getOrDefault("color", "#4dabf7");

        Workspace workspace = new Workspace(name, principal, description, color);
        Workspace saved = workspaceRepository.save(workspace);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorkspace(@PathVariable("id") UUID id) {
        workspaceRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
