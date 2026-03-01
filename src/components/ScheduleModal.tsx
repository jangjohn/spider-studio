import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompareModal } from './CompareModal';
import type {
  ScraperProject,
  ProjectSchedule,
  RunHistoryEntry,
  CompareRunsResult,
} from '../types';

interface ScheduleModalProps {
  project: ScraperProject;
  open: boolean;
  onClose: () => void;
  onSave: (project: ScraperProject) => void;
}

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function ScheduleModal({ project, open, onClose, onSave }: ScheduleModalProps) {
  const [frequency, setFrequency] = useState<string>(
    project.schedule?.frequency ?? 'none'
  );
  const [time, setTime] = useState(project.schedule?.time ?? '09:00');
  const [day, setDay] = useState<number>(project.schedule?.day ?? 0);
  const [outputFolder, setOutputFolder] = useState(
    project.schedule?.outputFolder ?? ''
  );
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [compareState, setCompareState] = useState<{
    fileA: string;
    fileB: string;
    labelA: string;
    labelB: string;
  } | null>(null);
  const [compareResult, setCompareResult] = useState<CompareRunsResult | null>(null);

  useEffect(() => {
    if (open && project.id) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<RunHistoryEntry[]>('get_run_history', { projectId: project.id }))
        .then(setRunHistory)
        .catch(() => setRunHistory([]));
    }
  }, [open, project.id]);

  const handleBrowse = async () => {
    try {
      const dialog = await import('@tauri-apps/plugin-dialog');
      const selected = await dialog.open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setOutputFolder(selected);
      }
    } catch (e) {
      console.error('Folder picker failed:', e);
    }
  };

  const handleSave = () => {
    const schedule: ProjectSchedule = {
      frequency: frequency as ProjectSchedule['frequency'],
      time: frequency === 'daily' || frequency === 'weekly' ? time : undefined,
      day: frequency === 'weekly' ? day : undefined,
      outputFolder: outputFolder || undefined,
      enabled: frequency !== 'none',
    };
    onSave({
      ...project,
      schedule,
    });
    onClose();
  };

  const runCompare = async (
    fileA: string,
    fileB: string,
    keyField: string | null
  ): Promise<CompareRunsResult | null> => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<CompareRunsResult>('compare_runs', {
        fileA,
        fileB,
        keyField,
      });
    } catch (e) {
      console.error('Compare failed:', e);
      return null;
    }
  };

  const handleCompare = async (
    baseEntry: RunHistoryEntry,
    compareEntry: RunHistoryEntry
  ) => {
    if (!baseEntry.outputPath || !compareEntry.outputPath) return;
    setCompareState({
      fileA: baseEntry.outputPath,
      fileB: compareEntry.outputPath,
      labelA: formatTimestamp(baseEntry.timestamp),
      labelB: formatTimestamp(compareEntry.timestamp),
    });
    setCompareResult(null);
    const result = await runCompare(
      baseEntry.outputPath,
      compareEntry.outputPath,
      null
    );
    setCompareResult(result);
  };

  const handleKeyFieldChange = async (keyField: string | null) => {
    if (!compareState) return;
    setCompareResult(null);
    const result = await runCompare(
      compareState.fileA,
      compareState.fileB,
      keyField
    );
    setCompareResult(result);
  };

  const formatTimestamp = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleString();
    } catch {
      return s;
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[14px] bg-[#242330] border border-[#353347] shadow-xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-[#E8E6F0]">
            Schedule: {project.name}
          </h2>
          <button
            onClick={onClose}
            className="text-[#9E9BB5] hover:text-[#E8E6F0] text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#9E9BB5] mb-2">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full py-2.5 px-4 rounded-[10px] bg-[#1C1B22] border border-[#353347]
                text-[#E8E6F0] focus:outline-none focus:border-[#7C6FF7]"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {(frequency === 'daily' || frequency === 'weekly') && (
            <div>
              <label className="block text-sm text-[#9E9BB5] mb-2">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full py-2.5 px-4 rounded-[10px] bg-[#1C1B22] border border-[#353347]
                  text-[#E8E6F0] focus:outline-none focus:border-[#7C6FF7]"
              />
            </div>
          )}

          {frequency === 'weekly' && (
            <div>
              <label className="block text-sm text-[#9E9BB5] mb-2">Day of week</label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full py-2.5 px-4 rounded-[10px] bg-[#1C1B22] border border-[#353347]
                  text-[#E8E6F0] focus:outline-none focus:border-[#7C6FF7]"
              >
                {WEEKDAYS.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {frequency !== 'none' && (
            <div>
              <label className="block text-sm text-[#9E9BB5] mb-2">Output folder</label>
              <div className="flex gap-2">
                <input
                  value={outputFolder}
                  onChange={(e) => setOutputFolder(e.target.value)}
                  placeholder="/path/to/folder"
                  className="flex-1 py-2.5 px-4 rounded-[10px] bg-[#1C1B22] border border-[#353347]
                    text-[#E8E6F0] font-mono text-sm placeholder-[#635F7A]
                    focus:outline-none focus:border-[#7C6FF7]"
                />
                <button
                  onClick={handleBrowse}
                  className="py-2.5 px-4 rounded-[10px] bg-[#2C2A3A] border border-[#353347]
                    text-[#E8E6F0] text-sm font-medium hover:bg-[#353347] transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full py-3 px-4 rounded-[10px] bg-[#7C6FF7] text-[#FFFFFF] font-medium
              hover:bg-[#8b7ff8] transition-colors"
          >
            Save Schedule
          </button>

          <div>
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="w-full flex items-center justify-between py-2 text-sm text-[#9E9BB5] hover:text-[#E8E6F0]"
            >
              <span>Run history</span>
              <span>{historyExpanded ? '−' : '+'}</span>
            </button>
            <AnimatePresence>
              {historyExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                    {runHistory.length === 0 ? (
                      <p className="text-xs text-[#635F7A]">No runs yet</p>
                    ) : (
                      runHistory.map((entry, idx) => {
                        const isMostRecent = idx === 0;
                        return (
                          <div
                            key={entry.id}
                            className="text-xs text-[#9E9BB5] p-2 rounded bg-[#1C1B22] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div>{formatTimestamp(entry.timestamp)}</div>
                              <div>
                                {entry.rowsCollected} rows · {entry.status}
                              </div>
                              {entry.outputPath && (
                                <div className="truncate text-[#635F7A] font-mono">
                                  {entry.outputPath}
                                </div>
                              )}
                            </div>
                            {!isMostRecent &&
                              entry.outputPath &&
                              runHistory[0]?.outputPath && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompare(runHistory[0], entry);
                                  }}
                                  className="shrink-0 py-1 px-2 rounded bg-[#2C2A3A] border border-[#353347] text-[#9E9BB5] hover:text-[#7C6FF7] hover:border-[#7C6FF7]/50 text-xs"
                                >
                                  Compare
                                </button>
                              )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {compareState && (
        <CompareModal
          open={!!compareState}
          onClose={() => {
            setCompareState(null);
            setCompareResult(null);
          }}
          result={compareResult}
          fileALabel={compareState?.labelA ?? ''}
          fileBLabel={compareState?.labelB ?? ''}
          onKeyFieldChange={handleKeyFieldChange}
        />
      )}
    </div>
  );
}
