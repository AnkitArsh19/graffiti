/**
 * Custom SVG data-URI cursors for drawing and erasing.
 * Dual-contrast (white fill + dark outline) ensures crystal clear visibility
 * across both dark and light canvases, scratchpads, and desktop overlays.
 */

export const PENCIL_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M18 2.5a2.121 2.121 0 0 1 3 3L7.5 19 2 22l3-5.5L18 2.5z' stroke='%23000000' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M18 2.5a2.121 2.121 0 0 1 3 3L7.5 19 2 22l3-5.5L18 2.5z' fill='%23ffffff' stroke='%2318181b' stroke-width='1.5' stroke-linejoin='round'/%3E%3Cpolygon points='2,22 4,17.5 6.5,20' fill='%2318181b'/%3E%3Cpath d='M15 5.5l3 3' stroke='%23a1a1aa' stroke-width='1.2'/%3E%3Ccircle cx='2' cy='22' r='0.75' fill='%23f43f5e'/%3E%3C/svg%3E") 2 22, crosshair`;

export const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none'%3E%3Crect x='3' y='3' width='18' height='18' rx='4' fill='%23ffffff' stroke='%2318181b' stroke-width='2'/%3E%3Cpath d='M3 11h18' stroke='%23ef4444' stroke-width='2'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%23ef4444'/%3E%3C/svg%3E") 11 11, cell`;

