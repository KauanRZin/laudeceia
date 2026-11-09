import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { restoreDatabaseBackup } from "../api/usersApi";
import { normalizeApiError } from "../api/http";

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function RestoreBackupModal({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  async function restore() {
    if (!file || !confirmed || restoring) return;
    setRestoring(true);
    setError("");
    try {
      await restoreDatabaseBackup(file);
    } catch (cause) {
      const failure = normalizeApiError(cause);
      setError(failure.status === 413 ? "O arquivo excede o limite de 20 MB." : failure.message);
      setRestoring(false);
      return;
    }
    onRestored();
  }

  return (
    <dialog ref={dialog} aria-labelledby="titulo-restaurar-backup"
      className="m-auto max-h-[90vh] w-11/12 max-w-lg overflow-y-auto rounded-2xl bg-white text-textPrimary shadow-2xl backdrop:bg-slate-950/60"
      onCancel={event => { event.preventDefault(); if (!restoring) onClose(); }}>
      <form className="space-y-5 p-6" onSubmit={event => { event.preventDefault(); void restore(); }}>
        <h2 id="titulo-restaurar-backup" className="flex items-center gap-2 text-xl font-semibold">
          <Upload size={20} /> Importar backup SQL
        </h2>
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Os dados atuais, incluindo usuários, clientes, seguros e logs, serão substituídos pelos dados do backup.
          Após a restauração, entre novamente com as credenciais do backup.
        </p>
        <label className="block">
          <span className="label">Arquivo exportado pelo SeguraPro (.sql, até 20 MB)</span>
          <input className="input" type="file" accept=".sql" required disabled={restoring} onChange={event => {
            const selected = event.target.files?.[0] ?? null;
            setConfirmed(false);
            const invalid = selected && (!/\.sql$/i.test(selected.name) || selected.size === 0 || selected.size > MAX_BACKUP_BYTES);
            setFile(invalid ? null : selected);
            setError(invalid ? "Selecione um arquivo .sql com conteúdo e de até 20 MB." : "");
          }} />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={confirmed} disabled={!file || restoring}
            onChange={event => setConfirmed(event.target.checked)} />
          Confirmo a substituição dos dados atuais pelo conteúdo deste backup.
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose} disabled={restoring}>Cancelar</button>
          <button type="submit" className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!file || !confirmed || restoring}>
            {restoring ? "Restaurando…" : "Restaurar dados"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
