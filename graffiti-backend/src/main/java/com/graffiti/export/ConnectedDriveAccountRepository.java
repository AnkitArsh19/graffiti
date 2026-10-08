package com.graffiti.export;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConnectedDriveAccountRepository extends JpaRepository<ConnectedDriveAccount, UUID> {
    List<ConnectedDriveAccount> findByUserIdOrderByCreatedAtAsc(UUID userId);
    Optional<ConnectedDriveAccount> findByIdAndUserId(UUID id, UUID userId);
    Optional<ConnectedDriveAccount> findByUserIdAndAccountEmail(UUID userId, String accountEmail);
}
