"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/zedu";

type Props = { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode };

/** Modal built on the native <dialog>: focus trap, Escape and top-layer stacking come from the browser. */
export function Modal({ open, onClose, title, description, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="zedu m-auto w-[min(440px,calc(100vw-32px))] rounded-z-xl border border-z-line bg-z-surface p-0 text-z-fg shadow-z-lg backdrop:bg-black/40"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id="modal-title" className="text-z-section text-z-fg">
                {title}
              </h2>
              {description && <p className="text-z-small text-z-fg-muted">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose}>
              <X aria-hidden />
            </IconButton>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
