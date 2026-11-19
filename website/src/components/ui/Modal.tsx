"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog box */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h3
            id="modal-title"
            className="font-serif text-2xl font-normal tracking-tight text-ink sm:text-3xl"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-muted transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            aria-label="Close dialog"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          {children}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-panel transition-colors hover:bg-[#2a2623] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
