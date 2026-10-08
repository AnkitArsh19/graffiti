package com.graffiti.page;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PageRepository extends JpaRepository<Page, UUID> {
    List<Page> findByRoomIdAndDeletedFalseOrderByPageOrderAsc(UUID roomId);
    long countByRoomIdAndDeletedFalse(UUID roomId);
    void deleteByRoomId(UUID roomId);
}
