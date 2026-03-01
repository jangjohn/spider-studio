import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconCheck, IconFile, IconTable } from './Icons';
import type { ExportFormat } from '../types';

interface ExportModalProps {
  open: boolean;
  rowCount: number;
  data?: Record<string, unknown>[];
  onClose: () => void;
  onExport: (format: ExportFormat, options: ExportOptions) => Promise<boolean>;
}

export interface ExportOptions {
  includeHeaders: boolean;
  autoOpenAfterExport: boolean;
  splitIntoFilesOf?: number;
  filename: string;
}

function defaultFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `scrape_${date}`;
}

const FORMATS: { id: ExportFormat; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'CSV', label: 'CSV', Icon: IconFile },
  { id: 'XLSX', label: 'XLSX', Icon: IconTable },
  { id: 'JSON', label: 'JSON', Icon: IconFile },
];

export function ExportModal({
  open,
  rowCount,
  onClose,
  onExport,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('CSV');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [autoOpenAfterExport, setAutoOpenAfterExport] = useState(true);
  const [splitIntoFiles, setSplitIntoFiles] = useState(false);
  const [splitSize, setSplitSize] = useState(1000);
  const [filename, setFilename] = useState(defaultFilename());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename());
      const load = async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const s = await invoke<Record<string, string>>('get_settings');
          const def = s?.default_export_format;
          if (def === 'CSV' || def === 'XLSX' || def === 'JSON') setFormat(def);
        } catch {}
      };
      load();
    }
  }, [open]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const success = await onExport(format, {
        includeHeaders,
        autoOpenAfterExport,
        splitIntoFilesOf: splitIntoFiles ? splitSize : undefined,
        filename,
      });
      if (success) onClose();
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-[20px] bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-[var(--shadow-sm)] p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <IconCheck className="w-6 h-6 text-[var(--color-secondary)] shrink-0" />
            <h2 className="text-lg font-medium text-[var(--color-primary)]">
              {rowCount.toLocaleString()} rows collected
            </h2>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-[var(--color-secondary)] mb-2">Export format</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-4 rounded-[14px] border transition-colors duration-100
                    ${format === f.id
                      ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'bg-[var(--color-elevated)] border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-muted)]'
                    }`}
                >
                  <f.Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHeaders}
                onChange={(e) => setIncludeHeaders(e.target.checked)}
                className="accent-[#7C6FF7]"
              />
              <span className="text-sm text-[var(--color-primary)]">Include headers</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoOpenAfterExport}
                onChange={(e) => setAutoOpenAfterExport(e.target.checked)}
                className="accent-[#7C6FF7]"
              />
              <span className="text-sm text-[var(--color-primary)]">Auto-open after export</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={splitIntoFiles}
                onChange={(e) => setSplitIntoFiles(e.target.checked)}
                className="accent-[#7C6FF7]"
              />
              <span className="text-sm text-[var(--color-primary)]">Split into files of</span>
              <input
                type="number"
                min={100}
                value={splitSize}
                onChange={(e) => setSplitSize(parseInt(e.target.value, 10) || 1000)}
                disabled={!splitIntoFiles}
                className="w-20 py-1 px-2 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                  text-[var(--color-primary)] text-sm disabled:opacity-50"
              />
              <span className="text-sm text-[var(--color-primary)]">rows</span>
            </label>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-[var(--color-secondary)] mb-2">Filename</label>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                text-[var(--color-primary)] font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleExport();
            }}
            disabled={exporting}
            className="w-full py-3 px-4 rounded-[10px] bg-[var(--color-accent)] text-white font-medium
              hover:bg-[#8b7ff8] transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
