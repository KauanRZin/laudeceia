import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  content: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, title, content, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4">
      <section className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="section-title mb-3 text-red-600">{title}</h2>
        <div className="mb-6 text-sm text-textSecondary">{content}</div>
        <div className="flex justify-end gap-2">
          <button className="btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors" onClick={onConfirm}>
            Sim, Confirmar
          </button>
        </div>
      </section>
    </div>
  );
}