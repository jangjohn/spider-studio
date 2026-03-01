import { useState } from 'react';
import { SectionTarget } from './SectionTarget';
import { SectionFields } from './SectionFields';
import { SectionPagination } from './SectionPagination';
import { SectionRunSettings } from './SectionRunSettings';
import { RunStatus } from './RunStatus';
import type { ScraperConfig, ScrapeProgress } from '../../types';

interface ConfigPanelProps {
  config: ScraperConfig;
  onConfigChange: (config: ScraperConfig) => void;
  isRunning: boolean;
  progress?: ScrapeProgress;
  onRun: () => void;
  onPause: () => void;
  onStop: () => void;
  onSaveProject?: () => void;
  onFetchRequested?: () => void;
  previewUrl?: string;
}

const INITIAL_EXPANDED: Record<number, boolean> = { 1: true, 2: false, 3: false, 4: false };

export function ConfigPanel({
  config,
  onConfigChange,
  isRunning,
  progress,
  onRun,
  onPause,
  onStop,
  onSaveProject,
  onFetchRequested,
  previewUrl,
}: ConfigPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>(INITIAL_EXPANDED);

  const handleSectionToggle = (section: number) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const markSectionComplete = (_section: number) => {
    // No auto-expand/collapse — sections are independent
  };

  if (isRunning && progress) {
    return (
      <RunStatus
        progress={progress}
        onPause={onPause}
        onStop={onStop}
      />
    );
  }

  return (
    <div className="w-[360px] min-w-[360px] h-full flex flex-col overflow-hidden min-h-0">
      <div className="config-panel-scroll flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain">
        <SectionTarget
          config={config}
          onConfigChange={onConfigChange}
          isExpanded={expandedSections[1] ?? false}
          onToggle={() => handleSectionToggle(1)}
          onComplete={markSectionComplete}
          onFetchRequested={onFetchRequested}
        />
        <SectionFields
          config={config}
          onConfigChange={onConfigChange}
          isExpanded={expandedSections[2] ?? false}
          onToggle={() => handleSectionToggle(2)}
          onComplete={markSectionComplete}
          previewUrl={previewUrl}
        />
        <SectionPagination
          config={config}
          onConfigChange={onConfigChange}
          isExpanded={expandedSections[3] ?? false}
          onToggle={() => handleSectionToggle(3)}
          onComplete={markSectionComplete}
        />
        <SectionRunSettings
          config={config}
          onConfigChange={onConfigChange}
          isExpanded={expandedSections[4] ?? false}
          onToggle={() => handleSectionToggle(4)}
          onComplete={markSectionComplete}
        />
      </div>
      <div className="shrink-0 p-4 border-t border-[var(--color-border)] space-y-2 bg-[var(--color-surface)]">
        <button
          onClick={onRun}
          className="w-full py-3 px-4 rounded-[10px] bg-[var(--color-accent)] text-white font-medium
            transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Run
        </button>
        {onSaveProject && (
          <button
            onClick={onSaveProject}
            className="w-full py-2 px-4 rounded-[10px] border border-[var(--color-border)] text-[var(--color-secondary)]
              hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors duration-100"
          >
            Save Project
          </button>
        )}
      </div>
    </div>
  );
}
