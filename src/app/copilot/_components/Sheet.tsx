'use client';
import { useEffect } from 'react';

/** Bottom sheet inside the phone frame. The parent keeps content mounted while it slides out. */
export default function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <>
      <div className={`cp-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`cp-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal={open} aria-hidden={!open}>
        <div className="cp-handle" />
        {children}
      </div>
    </>
  );
}
