import { motion, AnimatePresence } from 'framer-motion';
import type {
  ScraperConfig,
  PaginationMode,
} from '../../types';

interface SectionPaginationProps {
  config: ScraperConfig;
  onConfigChange: (config: ScraperConfig) => void;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete: (section: number) => void;
}

const PAGINATION_MODES: PaginationMode[] = ['None', 'Auto-detect', 'Manual'];

export function SectionPagination({
  config,
  onConfigChange,
  isExpanded,
  onToggle,
}: SectionPaginationProps) {
  const { pagination } = config;

  const updatePagination = (updates: Partial<typeof pagination>) => {
    onConfigChange({
      ...config,
      pagination: { ...pagination, ...updates },
    });
  };

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 rounded-[14px] bg-[var(--color-elevated)]
          hover:bg-[var(--color-border)]/50 transition-colors duration-100 text-left"
      >
        <span className="font-medium text-[var(--color-primary)]">3. Pagination</span>
        <span className="text-[var(--color-muted)]">{isExpanded ? '−' : '+'}</span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              <div className="space-y-2">
                {PAGINATION_MODES.map((mode) => (
                  <label
                    key={mode}
                    className="flex items-center gap-3 py-2 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="pagination"
                      checked={pagination.mode === mode}
                      onChange={() => updatePagination({ mode })}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-[var(--color-primary)] group-hover:text-[var(--color-primary)]">
                      {mode}
                    </span>
                  </label>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {pagination.mode === 'Manual' && (
                  <motion.div
                    key="manual"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4">
                      <label className="block text-sm text-[var(--color-secondary)] mb-2">
                        Next button selector
                      </label>
                      <input
                        value={pagination.nextButtonSelector ?? ''}
                        onChange={(e) =>
                          updatePagination({ nextButtonSelector: e.target.value })
                        }
                        placeholder=".next-page"
                        className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                          text-[var(--color-primary)] font-mono text-sm placeholder-[var(--color-muted)]
                          focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(pagination.mode === 'Auto-detect' || pagination.mode === 'Manual') && (
                <div>
                  <label className="block text-sm text-[var(--color-secondary)] mb-2">
                    Max pages
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={pagination.maxPages ?? 50}
                    onChange={(e) =>
                      updatePagination({
                        maxPages: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                      text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
