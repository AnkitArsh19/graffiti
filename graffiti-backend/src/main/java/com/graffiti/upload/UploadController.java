package com.graffiti.upload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
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

/** Local media and file storage used by canvas image, video, audio, and document elements. */
@RestController
@RequestMapping("/upload")
public class UploadController {

    private final Path root;

    public UploadController(@Value("${app.upload.dir:./uploads}") String directory) {
        this.root = Path.of(directory).toAbsolutePath().normalize();
    }

    @PostMapping(value = {"/media", "/image"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Files.createDirectories(root);
        String originalFilename = file.getOriginalFilename();
        String extension = StringUtils.getFilenameExtension(originalFilename);
        String id = UUID.randomUUID() + (extension == null ? "" : "." + extension.replaceAll("[^A-Za-z0-9]", ""));
        Path targetPath = root.resolve(id);
        file.transferTo(targetPath);

        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            try {
                contentType = Files.probeContentType(targetPath);
            } catch (Exception ignored) {}
        }
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok(Map.of(
                "fileId", id,
                "url", "/upload/media/" + id,
                "name", originalFilename != null ? originalFilename : id,
                "contentType", contentType,
                "size", file.getSize()
        ));
    }

    @GetMapping(value = {"/media/{fileId:.+}", "/image/{fileId:.+}"})
    public ResponseEntity<Resource> download(@PathVariable("fileId") String fileId) {
        Path path = root.resolve(fileId).normalize();
        if (!path.startsWith(root) || !Files.isRegularFile(path)) {
            return ResponseEntity.notFound().build();
        }

        String contentType = null;
        try {
            contentType = Files.probeContentType(path);
        } catch (IOException ignored) {}

        if (contentType == null) {
            String lower = fileId.toLowerCase();
            if (lower.endsWith(".mp4")) contentType = "video/mp4";
            else if (lower.endsWith(".webm")) contentType = "video/webm";
            else if (lower.endsWith(".mp3")) contentType = "audio/mpeg";
            else if (lower.endsWith(".wav")) contentType = "audio/wav";
            else if (lower.endsWith(".ogg")) contentType = "audio/ogg";
            else if (lower.endsWith(".m4a")) contentType = "audio/mp4";
            else if (lower.endsWith(".png")) contentType = "image/png";
            else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
            else if (lower.endsWith(".svg")) contentType = "image/svg+xml";
            else if (lower.endsWith(".gif")) contentType = "image/gif";
            else if (lower.endsWith(".webp")) contentType = "image/webp";
            else if (lower.endsWith(".pdf")) contentType = "application/pdf";
            else contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .contentType(MediaType.parseMediaType(contentType))
                .body(new FileSystemResource(path));
    }
}
