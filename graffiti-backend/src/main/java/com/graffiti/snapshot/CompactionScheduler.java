package com.graffiti.snapshot;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Background scheduler periodically triggering snapshot compaction across active rooms.
 *
 * Runs every 60 seconds (fixedDelay = 60000).
 * Disabled during test execution profile (!test).
 */
@Component
@Profile("!test")
public class CompactionScheduler {

    private static final Logger log = LoggerFactory.getLogger(CompactionScheduler.class);
    private final CompactionService compactionService;

    public CompactionScheduler(CompactionService compactionService) {
        this.compactionService = compactionService;
    }

    @Scheduled(fixedDelayString = "${app.compaction.fixed-delay-ms:60000}")
    public void runCompactionScan() {
        log.debug("Starting periodic snapshot compaction scan...");
        compactionService.compactAllRoomsNeedingCompaction();
    }
}
