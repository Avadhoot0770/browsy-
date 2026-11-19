import React, { useRef } from "react";
import { useDraggable, type Position } from "./useDraggable";

export type AssistantVisualState = "compact" | "enlarged" | "panel";

interface BrowsyLauncherProps {
  visualState: AssistantVisualState;
  onChangeState: (nextState: AssistantVisualState) => void;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const DEFAULT_LAUNCHER_POS = (): Position => {
  if (typeof window === "undefined") return { x: 1000, y: 350 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.max(16, w - 195 - 20),
    y: Math.max(16, Math.round(h / 2 - 24)),
  };
};

export const BrowsyLauncher: React.FC<BrowsyLauncherProps> = ({
  visualState,
  onChangeState,
  isOpen,
  onOpen,
  onClose,
}) => {
  const launcherRef = useRef<HTMLDivElement>(null);

  const panelIsActive = isOpen ?? visualState === "panel";
  const elementWidth = 180;
  const elementHeight = 46;

  const { position, isDragging, suppressClickRef, bindProps } = useDraggable({
    storageKey: "browsy_launcher_pos",
    defaultPosition: DEFAULT_LAUNCHER_POS,
    elementWidth,
    elementHeight,
    margin: 12,
  });

  // When panel is active, ensure launcher does not get covered by panel
  const effectiveX = (() => {
    if (typeof window === "undefined") return position.x;
    if (!panelIsActive) return position.x;
    const panelW = 450;
    const panelX = Math.max(16, window.innerWidth - panelW - 20);
    if (position.x + elementWidth > panelX) {
      return Math.max(12, panelX - elementWidth - 12);
    }
    return position.x;
  })();

  const handleClick = (e: React.MouseEvent) => {
    // If user dragged more than threshold, do not fire click action
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (panelIsActive) {
      // Toggle closed if already open
      onChangeState("compact");
      onClose?.();
    } else {
      // Open the assistant panel immediately
      onChangeState("panel");
      onOpen?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (panelIsActive) {
        onChangeState("compact");
        onClose?.();
      } else {
        onChangeState("panel");
        onOpen?.();
      }
    } else if (e.key === "Escape" && panelIsActive) {
      e.preventDefault();
      onChangeState("compact");
      onClose?.();
    }
  };

  return (
    <div
      ref={launcherRef}
      className={`browsy-launcher-wrap state-${visualState} ${isDragging ? "dragging" : ""} ${panelIsActive ? "panel-open" : ""}`}
      style={{
        left: `${effectiveX}px`,
        top: `${position.y}px`,
      }}
      role="region"
      aria-label="Browsy Assistant Floating Launcher"
      {...bindProps}
    >
      <button
        type="button"
        className={`browsy-launcher-btn ${panelIsActive ? "active open" : "compact"}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={
          panelIsActive
            ? "Close Browsy Assistant (Click to toggle)"
            : "Open Browsy Assistant (Click to open · Drag to reposition)"
        }
        title={
          panelIsActive
            ? "Click to close Browsy assistant"
            : "✦ Browsy Assistant (Click to open · Drag anywhere)"
        }
      >
        <div className="browsy-launcher-left">
          <span className="browsy-sparkle" aria-hidden="true">
            {panelIsActive ? "✕" : "✦"}
          </span>
          <span className="browsy-wordmark-text">Browsy</span>
        </div>

        <div className="browsy-launcher-right">
          <span className="browsy-badge">{panelIsActive ? "CLOSE" : "ASSISTANT"}</span>
        </div>
      </button>
    </div>
  );
};
