import { motion } from 'framer-motion';
import type { ScrapeProgress } from '../../types';

interface RunStatusProps {
  progress: ScrapeProgress;
  onPause: () => void;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function RunStatus({ progress, onPause, onStop }: RunStatusProps) {
  const percent =
    progress.total_pages > 0
      ? Math.round((progress.page / progress.total_pages) * 100)
      : 0;

  const handleStop = () => {
    if (window.confirm('Are you sure you want to stop the scrape?')) {
      onStop();
    }
  };

  return (
    <div className="w-[360px] min-w-[360px] bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col p-4">
      <div className="flex items-center gap-2 mb-4">
        <motion.span
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-[var(--color-success)]"
        />
        <span className="font-medium text-[var(--color-primary)]">Running</span>
      </div>

      <div className="text-sm text-[var(--color-secondary)] mb-4">
        Page {progress.page} / {progress.total_pages}
      </div>

      <div className="mb-6">
        <div className="h-1.5 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--color-accent), var(--color-success))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      <div className="space-y-2 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-[#635F7A]">Speed</span>
          <span className="text-[#E8E6F0]">{progress.speed} rows/min</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#635F7A]">Errors</span>
          <span className="text-[#E8A87C]">
            {progress.errors} (auto-retried)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#635F7A]">ETA</span>
          <span className="text-[#E8E6F0]">{formatTime(progress.eta_seconds)}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={onPause}
          className="flex-1 py-2.5 px-4 rounded-[10px] bg-[var(--color-elevated)] border border-[var(--color-border)]
            text-[var(--color-primary)] text-sm font-medium hover:bg-[var(--color-border)] transition-colors duration-100"
        >
          Pause
        </button>
        <button
          onClick={handleStop}
          className="flex-1 py-2.5 px-4 rounded-[10px] bg-[var(--color-error)]/20 border border-[var(--color-error)]
            text-[var(--color-error)] text-sm font-medium hover:bg-[var(--color-error)]/30 transition-colors duration-100"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
