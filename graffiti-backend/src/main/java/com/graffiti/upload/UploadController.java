package com.graffiti.upload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

/** Local image storage used by canvas image elements in self-hosted deployments. */
@RestController
@RequestMapping("/upload")
public class UploadController {
    private final Path root;
    public UploadController(@Value("${app.upload.dir:./uploads}") String directory) { this.root = Path.of(directory).toAbsolutePath().normalize(); }

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getContentType() == null || !file.getContentType().startsWith("image/")) return ResponseEntity.badRequest().build();
        Files.createDirectories(root);
        String extension = StringUtils.getFilenameExtension(file.getOriginalFilename());
        String id = UUID.randomUUID() + (extension == null ? "" : "." + extension.replaceAll("[^A-Za-z0-9]", ""));
        file.transferTo(root.resolve(id));
        return ResponseEntity.ok(Map.of("fileId", id, "url", "/upload/image/" + id));
    }

    @GetMapping("/image/{fileId:.+}")
    public ResponseEntity<FileSystemResource> download(@PathVariable String fileId) {
        Path path = root.resolve(fileId).normalize();
        if (!path.startsWith(root) || !Files.isRegularFile(path)) return ResponseEntity.notFound().build();
        try { return ResponseEntity.ok().contentType(MediaType.parseMediaType(Files.probeContentType(path))).body(new FileSystemResource(path)); }
        catch (IOException ignored) { return ResponseEntity.ok().body(new FileSystemResource(path)); }
    }
}
