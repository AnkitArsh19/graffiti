package com.graffiti.security.desktop;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DesktopHandoffCodeRepository extends JpaRepository<DesktopHandoffCode, UUID> {

    Optional<DesktopHandoffCode> findByCodeHash(String codeHash);

    @Modifying
    @Query("delete from DesktopHandoffCode c where c.expiresAt < :now")
    void deleteAllExpiredBefore(Instant now);
}
