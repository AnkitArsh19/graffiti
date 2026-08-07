package com.graffiti.op;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service providing database persistence operations for canvas shape edits.
 */
@Service
public class OpService {

    private final OpRepository opRepository;

    public OpService(OpRepository opRepository) {
        this.opRepository = opRepository;
    }

    /**
     * Persists an Op entity.
     *
     * @param op Target Op entity
     * @return Saved Op entity
     */
    @Transactional
    public Op saveOp(Op op) {
        return opRepository.save(op);
    }

    /**
     * Fetches all operations for a room executed after a specified Lamport timestamp checkpoint.
     *
     * @param roomId Target room ID
     * @param lamportTs Lamport timestamp threshold
     * @return List of Op entities ordered by Lamport timestamp ascending
     */
    public List<Op> getOpsAfterLamport(UUID roomId, Long lamportTs) {
        return opRepository.findByRoomIdAndLamportTsGreaterThanOrderByLamportTsAsc(roomId, lamportTs);
    }
}
