import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CompareRunsResult, CompareTableRow, CompareRowStatus } from '../types';

interface CompareModalProps {
  open: boolean;
  onClose: () => void;
  result: CompareRunsResult | null;
  fileALabel: string;
  fileBLabel: string;
  onKeyFieldChange?: (keyField: string | null) => void;
}

const statusColors: Record<CompareRowStatus, string> = {
  new: 'bg-[#6BCB8B]',
  removed: 'bg-[#E87C7C]',
  changed: 'bg-[#E8A87C]',
  unchanged: 'bg-[#9E9BB5]',
};

export function CompareModal({
  open,
  onClose,
  result,
  fileALabel,
  fileBLabel,
  onKeyFieldChange,
}: CompareModalProps) {
  const [filter, setFilter] = useState<CompareRowStatus | 'all'>('all');
  const [exporting, setExporting] = useState(false);
  const [keyFieldForCompare, setKeyFieldForCompare] = useState<string>('');

  const tableRows = useMemo((): CompareTableRow[] => {
    if (!result) return [];
    const rows: CompareTableRow[] = [];
    for (const row of result.added) {
      rows.push({ status: 'new', row });
    }
    for (const row of result.removed) {
      rows.push({ status: 'removed', row });
    }
    for (const cr of result.changed) {
      rows.push({
        status: 'changed',
        old: cr.old as Record<string, string | number | null>,
        new: cr.new as Record<string, string | number | null>,
        changedFields: cr.changedFields,
      });
    }
    for (const row of result.unchanged) {
      rows.push({ status: 'unchanged', row });
    }
    return rows;
  }, [result]);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return tableRows;
    return tableRows.filter((r) => r.status === filter);
  }, [tableRows, filter]);

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const name = `compare_diff_${Date.now()}`;
      await invoke('export_compare_diff', { result, filename: name });
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const toStr = (v: string | number | null | undefined): string => {
    if (v == null) return '';
    return String(v);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[14px] bg-[#242330] border border-[#353347] shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-[#353347]">
          <h2 className="text-lg font-medium text-[#E8E6F0]">
            Compare: {fileBLabel} vs {fileALabel}
          </h2>
          <button
            onClick={onClose}
            className="text-[#9E9BB5] hover:text-[#E8E6F0] text-xl"
          >
            ×
          </button>
        </div>

        {result && (
          <>
            <div className="px-5 py-3 border-b border-[#353347] flex flex-wrap gap-4 items-center">
              <span className="text-sm text-[#6BCB8B]">
                {result.added.length} new
              </span>
              <span className="text-sm text-[#E87C7C]">
                {result.removed.length} removed
              </span>
              <span className="text-sm text-[#E8A87C]">
                {result.changed.length} changed
              </span>
              <span className="text-sm text-[#9E9BB5]">
                {result.unchanged.length} unchanged
              </span>
              {result.headers.length > 0 && onKeyFieldChange && (
                <select
                  value={keyFieldForCompare}
                  onChange={async (e) => {
                    const val = e.target.value || '';
                    setKeyFieldForCompare(val);
                    await onKeyFieldChange(val || null);
                  }}
                  className="ml-auto py-1.5 px-3 rounded-lg bg-[#1C1B22] border border-[#353347] text-sm text-[#E8E6F0]"
                >
                  <option value="">Key field (positional)</option>
                  {result.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="px-5 py-2 flex gap-2 border-b border-[#353347]">
              {(['all', 'new', 'removed', 'changed', 'unchanged'] as const).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                      filter === f
                        ? 'bg-[#7C6FF7] text-white'
                        : 'bg-[#2C2A3A] text-[#9E9BB5] hover:text-[#E8E6F0]'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                )
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="ml-auto py-1.5 px-3 rounded-lg bg-[#2C2A3A] border border-[#353347] text-sm text-[#E8E6F0] hover:bg-[#353347] disabled:opacity-50"
              >
                {exporting ? 'Exporting…' : 'Export diff as CSV'}
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-2 text-[#9E9BB5] font-medium w-8">
                        {' '}
                      </th>
                      {result.headers.map((h) => (
                        <th
                          key={h}
                          className="text-left py-2 px-2 text-[#9E9BB5] font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-[#353347]/50 ${
                          r.status === 'removed' ? 'bg-[#E87C7C]/10' : ''
                        } ${r.status === 'new' ? 'bg-[#6BCB8B]/10' : ''} ${
                          r.status === 'changed' ? 'bg-[#E8A87C]/10' : ''
                        }`}
                      >
                        <td className="py-2 px-2">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full ${statusColors[r.status]}`}
                            title={r.status}
                          />
                        </td>
                        {result.headers.map((h) => {
                          if (r.status === 'changed' && r.old && r.new) {
                            const isChanged = r.changedFields?.includes(h);
                            const oldVal = toStr(r.old[h]);
                            const newVal = toStr(r.new[h]);
                            return (
                              <td
                                key={h}
                                className={`py-2 px-2 ${
                                  isChanged ? 'bg-[#E8A87C]/20' : ''
                                }`}
                              >
                                {isChanged ? (
                                  <div>
                                    <span className="line-through text-[#9E9BB5]">
                                      {oldVal}
                                    </span>
                                    <div className="text-[#E8E6F0]">
                                      {newVal}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[#E8E6F0]">
                                    {newVal}
                                  </span>
                                )}
                              </td>
                            );
                          }
                          const row = r.row ?? r.new ?? r.old ?? {};
                          return (
                            <td key={h} className="py-2 px-2 text-[#E8E6F0]">
                              {toStr(row[h])}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRows.length === 0 && (
                <p className="text-[#635F7A] text-sm py-8 text-center">
                  No rows match the filter
                </p>
              )}
            </div>
          </>
        )}

        {!result && (
          <div className="p-8 text-center text-[#9E9BB5]">
            Loading comparison…
          </div>
        )}
      </motion.div>
    </div>
  );
}
