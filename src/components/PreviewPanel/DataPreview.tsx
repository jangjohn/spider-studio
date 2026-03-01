import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTable } from '../Icons';
import type { ScrapeRow } from '../../types';

interface DataPreviewProps {
  data: ScrapeRow[];
}

export function DataPreview({ data }: DataPreviewProps) {
  const [selectedRow, setSelectedRow] = useState<ScrapeRow | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const columns =
    columnOrder.length > 0
      ? columnOrder
      : data.length > 0
        ? Object.keys(data[0])
        : [];

  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <IconTable className="w-16 h-16 mb-4 text-[#9E9BB5]" />
        <p className="text-[#9E9BB5] text-center max-w-xs">
          Configure fields and run to see data here
        </p>
      </div>
    );
  }

  const rowsPerMinute = 0; // TODO: from progress
  const etaSeconds = 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-[#242330] z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-[#9E9BB5] font-medium border-b border-[#353347]
                    cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('column', col);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData('column');
                    if (from && from !== col) {
                      const newOrder = [...columns];
                      const fromIdx = newOrder.indexOf(from);
                      const toIdx = newOrder.indexOf(col);
                      if (fromIdx !== -1 && toIdx !== -1) {
                        newOrder.splice(fromIdx, 1);
                        newOrder.splice(toIdx, 0, from);
                        setColumnOrder(newOrder);
                      }
                    }
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                onClick={() => setSelectedRow(row)}
                className="border-b border-[#353347]/50 hover:bg-[#242330] cursor-pointer
                  transition-colors duration-100"
              >
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2.5 text-[#E8E6F0] max-w-[200px] truncate">
                    {row[col] != null ? String(row[col]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-[#353347] flex items-center justify-between text-xs text-[#635F7A]">
        <span>
          {data.length.toLocaleString()} rows collected
          {rowsPerMinute > 0 && ` · Speed: ${rowsPerMinute} rows/min`}
          {etaSeconds > 0 && ` · ETA: ${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s`}
        </span>
      </div>

      <AnimatePresence>
        {selectedRow && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setSelectedRow(null)}
            />
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ duration: 0.2 }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-[#242330] border-l border-[#353347]
                z-50 overflow-auto shadow-[0_4px_12px_#0D0C1460]"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-[#E8E6F0]">Row Detail</h3>
                  <button
                    onClick={() => setSelectedRow(null)}
                    className="text-[#635F7A] hover:text-[#E8E6F0]"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-3">
                  {Object.entries(selectedRow).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-[#635F7A] mb-1">{key}</div>
                      <div className="text-sm text-[#E8E6F0] break-words">
                        {value != null ? String(value) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
