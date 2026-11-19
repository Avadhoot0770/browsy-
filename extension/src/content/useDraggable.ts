import { useState, useEffect, useRef, useCallback } from "react";

export interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  storageKey: string;
  defaultPosition: () => Position;
  elementWidth: number;
  elementHeight: number;
  margin?: number;
  onDragStart?: () => void;
  onDragEnd?: (pos: Position) => void;
}

/**
 * Custom hook to handle smooth pointer-based dragging anywhere in the viewport,
 * with viewport boundary clamping, click vs. drag distinction, and storage persistence.
 */
export function useDraggable({
  storageKey,
  defaultPosition,
  elementWidth,
  elementHeight,
  margin = 12,
  onDragStart,
  onDragEnd,
}: UseDraggableOptions) {
  const [position, setPosition] = useState<Position>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const isPointerDownRef = useRef(false);
  const hasMovedRef = useRef(false);
  const startPointerRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);

  const positionRef = useRef<Position>(position);
  positionRef.current = position;

  // Clamp helper
  const clampPosition = useCallback(
    (x: number, y: number, w: number = elementWidth, h: number = elementHeight): Position => {
      const winW = typeof window !== "undefined" ? window.innerWidth : 1280;
      const winH = typeof window !== "undefined" ? window.innerHeight : 800;

      const minX = margin;
      const maxX = Math.max(margin, winW - w - margin);
      const minY = margin;
      const maxY = Math.max(margin, winH - h - margin);

      return {
        x: Math.round(Math.max(minX, Math.min(maxX, x))),
        y: Math.round(Math.max(minY, Math.min(maxY, y))),
      };
    },
    [elementWidth, elementHeight, margin]
  );

  // Load persisted position on mount
  useEffect(() => {
    let loaded = false;
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get([storageKey], (res) => {
          if (res && res[storageKey] && typeof res[storageKey].x === "number") {
            const clamped = clampPosition(res[storageKey].x, res[storageKey].y);
            positionRef.current = clamped;
            setPosition(clamped);
            loaded = true;
          }
        });
      }
    } catch {
      // ignore
    }

    if (!loaded) {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.x === "number") {
            const clamped = clampPosition(parsed.x, parsed.y);
            positionRef.current = clamped;
            setPosition(clamped);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [storageKey, clampPosition]);

  // Keep position clamped on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const clamped = clampPosition(prev.x, prev.y);
        positionRef.current = clamped;
        return clamped;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  // Pointer event handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Only drag with primary mouse button / touch
      if (e.button !== 0) return;

      isPointerDownRef.current = true;
      hasMovedRef.current = false;
      startPointerRef.current = { x: e.clientX, y: e.clientY };
      startPosRef.current = { ...positionRef.current };
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current) return;

      const dx = e.clientX - startPointerRef.current.x;
      const dy = e.clientY - startPointerRef.current.y;
      const dist = Math.hypot(dx, dy);

      // Only initiate dragging after crossing minimum movement threshold (8px)
      if (dist >= 8) {
        if (!hasMovedRef.current) {
          hasMovedRef.current = true;
          setIsDragging(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore if not supported
          }
          onDragStart?.();
        }
        const newPos = clampPosition(
          startPosRef.current.x + dx,
          startPosRef.current.y + dy
        );
        positionRef.current = newPos;
        setPosition(newPos);
      }
    },
    [clampPosition, onDragStart]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      if (hasMovedRef.current) {
        // A genuine drag took place
        suppressClickRef.current = true;
        setIsDragging(false);

        // Persist final position
        setPosition((currentPos) => {
          try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
              chrome.storage.local.set({ [storageKey]: currentPos });
            }
          } catch {
            // ignore
          }
          try {
            sessionStorage.setItem(storageKey, JSON.stringify(currentPos));
          } catch {
            // ignore
          }
          onDragEnd?.(currentPos);
          return currentPos;
        });

        // Reset suppressClick flag after click event cycle ends
        setTimeout(() => {
          suppressClickRef.current = false;
          hasMovedRef.current = false;
        }, 80);
      } else {
        setIsDragging(false);
      }
    },
    [storageKey, onDragEnd]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      isPointerDownRef.current = false;
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setTimeout(() => {
        suppressClickRef.current = false;
        hasMovedRef.current = false;
      }, 50);
    },
    []
  );

  return {
    position,
    setPosition,
    isDragging,
    suppressClickRef,
    bindProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
