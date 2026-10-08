import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { OverlayCanvas } from "./components/OverlayCanvas";

const root = document.getElementById("overlay-root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ShortcutsProvider>
        <OverlayCanvas />
      </ShortcutsProvider>
    </StrictMode>
  );
}

