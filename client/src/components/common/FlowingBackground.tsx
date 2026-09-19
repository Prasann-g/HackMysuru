import React from 'react';

/**
 * FlowingBackground
 *
 * A fixed, full-viewport decorative layer that renders large, softly blurred,
 * wave-like shapes in CivicBridge's ivory/gold/charcoal palette.
 *
 * Design intent:
 *  - Emulates soft fabric-like layers with blurred boundaries and slow drift.
 *  - All colors are extremely low opacity so the effect never obscures content.
 *  - Animations respect `prefers-reduced-motion`.
 *
 * To disable: remove <FlowingBackground /> from App.tsx.
 * All styles live in index.css under the "/* === FLOWING BACKGROUND ===" block.
 */
export const FlowingBackground: React.FC = () => (
  <div
    className="civic-flow-root"
    aria-hidden="true"
    role="presentation"
  >
    {/* Layer 1 — large sweeping warm-gold wave, top-left to center */}
    <div className="civic-flow-shape civic-flow-shape-1" />
    {/* Layer 2 — wide low charcoal wave, center spanning right */}
    <div className="civic-flow-shape civic-flow-shape-2" />
    {/* Layer 3 — tall beige organic shape, lower-left */}
    <div className="civic-flow-shape civic-flow-shape-3" />
    {/* Layer 4 — subtle champagne arc, upper-right accent */}
    <div className="civic-flow-shape civic-flow-shape-4" />
    {/* Layer 5 — very faint mid-layer crossing wave for depth */}
    <div className="civic-flow-shape civic-flow-shape-5" />
  </div>
);
