package com.graffiti.page;

import com.graffiti.exception.ResourceNotFoundException;
import com.graffiti.room.Room;
import com.graffiti.room.RoomService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class PageService {
    private final PageRepository pages;
    private final RoomService rooms;
    public PageService(PageRepository pages, RoomService rooms) { this.pages = pages; this.rooms = rooms; }

    @Transactional
    public Page create(String slug, UUID userId, CreatePageRequest request) {
        Room room = rooms.requireEditor(slug, userId);
        int order = request.getPageOrder() == null ? (int) pages.countByRoomIdAndDeletedFalse(room.getId()) : Math.max(0, request.getPageOrder());
        shiftForInsert(room.getId(), order, null);
        return pages.save(new Page(room.getId(), nonBlank(request.getTitle(), "Canvas " + (order + 1)), nonBlank(request.getTemplate(), "grid"), order));
    }

    @Transactional
    public Page update(String slug, UUID pageId, UUID userId, UpdatePageRequest request) {
        Room room = rooms.requireEditor(slug, userId);
        Page page = pages.findById(pageId).filter(p -> p.getRoomId().equals(room.getId()) && !p.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("PAGE_NOT_FOUND", "Page not found"));
        if (request.getTitle() != null) page.setTitle(nonBlank(request.getTitle(), page.getTitle()));
        if (request.getTemplate() != null) page.setTemplate(nonBlank(request.getTemplate(), page.getTemplate()));
        if (request.getPageOrder() != null && request.getPageOrder() != page.getPageOrder()) {
            int target = Math.max(0, Math.min(request.getPageOrder(), (int) pages.countByRoomIdAndDeletedFalse(room.getId()) - 1));
            List<Page> ordered = pages.findByRoomIdAndDeletedFalseOrderByPageOrderAsc(room.getId());
            ordered.removeIf(p -> p.getId().equals(page.getId()));
            ordered.add(target, page);
            for (int i = 0; i < ordered.size(); i++) ordered.get(i).setPageOrder(i);
        }
        return pages.save(page);
    }

    @Transactional
    public void delete(String slug, UUID pageId, UUID userId) {
        Room room = rooms.requireEditor(slug, userId);
        Page page = pages.findById(pageId).filter(p -> p.getRoomId().equals(room.getId()) && !p.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("PAGE_NOT_FOUND", "Page not found"));
        if (pages.countByRoomIdAndDeletedFalse(room.getId()) <= 1) throw new IllegalStateException("A room must retain at least one page");
        page.setDeleted(true); pages.save(page);
    }

    public List<Page> list(String slug) { return pages.findByRoomIdAndDeletedFalseOrderByPageOrderAsc(rooms.getRoomBySlug(slug).getId()); }
    private void shiftForInsert(UUID roomId, int order, UUID except) { for (Page p : pages.findByRoomIdAndDeletedFalseOrderByPageOrderAsc(roomId)) if (!p.getId().equals(except) && p.getPageOrder() >= order) p.setPageOrder(p.getPageOrder() + 1); }
    private String nonBlank(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }
}
