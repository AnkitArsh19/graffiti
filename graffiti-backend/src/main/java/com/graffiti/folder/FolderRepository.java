package com.graffiti.folder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {
    List<Folder> findByWorkspaceId(UUID workspaceId);
    List<Folder> findByWorkspaceIdAndParentFolderId(UUID workspaceId, UUID parentFolderId);
}
