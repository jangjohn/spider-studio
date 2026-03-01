import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, FileText, Trash2 } from 'lucide-react';
import { IconExport } from '../components/Icons';
import type { ExportRecord } from '../types';

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function ExportsView() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExports = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list = await invoke<ExportRecord[]>('list_exports');
      setExports(list);
    } catch (e) {
      console.error('Failed to load exports:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExports();
  }, []);

  const handleOpenFile = async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_export_file', { filePath: path });
    } catch (e) {
      console.error('Open failed:', e);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_export_folder', { filePath: path });
    } catch (e) {
      console.error('Open folder failed:', e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_export', { id });
      loadExports();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (exports.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <IconExport className="w-16 h-16 mb-4 text-[var(--color-muted)]" />
        <p className="text-[var(--color-secondary)] text-center max-w-sm">
          No exports yet — run a scrape and export to see files here
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl space-y-3">
        {exports.map((exp) => (
          <motion.div
            key={exp.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 p-4 rounded-[14px] bg-[var(--color-surface)] border border-[var(--color-border)]
              hover:border-[var(--color-accent)]/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[var(--color-primary)] truncate">
                {exp.filename}.{exp.format.toLowerCase()}
              </div>
              <div className="flex gap-4 mt-1 text-xs text-[var(--color-secondary)]">
                <span>{exp.format}</span>
                <span>{exp.rows.toLocaleString()} rows</span>
                <span>{formatDate(exp.exportedAt)}</span>
                <span>{formatFileSize(exp.fileSize)}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleOpenFile(exp.filePath)}
                className="p-2 rounded-[10px] bg-[var(--color-elevated)] border border-[var(--color-border)]
                  text-[var(--color-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/50
                  transition-colors"
                title="Open file"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleOpenFolder(exp.filePath)}
                className="p-2 rounded-[10px] bg-[var(--color-elevated)] border border-[var(--color-border)]
                  text-[var(--color-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/50
                  transition-colors"
                title="Open folder"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(exp.id)}
                className="p-2 rounded-[10px] bg-[var(--color-elevated)] border border-[var(--color-border)]
                  text-[var(--color-secondary)] hover:text-[var(--color-error)] hover:border-[var(--color-error)]/50
                  transition-colors"
                title="Delete record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
