import { useState, useCallback, useEffect, useRef } from 'react';
import { ConfigPanel } from '../components/ConfigPanel/ConfigPanel';
import { PreviewPanel } from '../components/PreviewPanel/PreviewPanel';
import {
  fetchPreviewScreenshot,
  type PreviewScreenshotResult,
} from '../lib/previewWindow';
import type {
  ScraperConfig,
  ScraperProject,
  ScrapeProgress,
  ScrapeRow,
} from '../types';
import type { PreviewTab } from '../components/PreviewPanel/PreviewPanel';
import type { PreviewLoadStatus } from '../lib/previewWindow';

const DEFAULT_CONFIG: ScraperConfig = {
  url: '',
  method: 'GET',
  headers: [],
  fields: [],
  pagination: { mode: 'None', maxPages: 50 },
  runSettings: {
    delayBetweenRequests: 1,
    retryOnFailure: 3,
    respectRobotsTxt: true,
    userAgent: 'Chrome',
  },
};

interface ScraperViewProps {
  initialProject?: ScraperProject | null;
  autoRun?: boolean;
  onScrapeComplete?: (rowCount: number, data: ScrapeRow[]) => void;
}

export function ScraperView({ initialProject, autoRun, onScrapeComplete }: ScraperViewProps) {
  const [config, setConfig] = useState<ScraperConfig>(
    initialProject?.config ?? DEFAULT_CONFIG
  );
  const [data, setData] = useState<ScrapeRow[]>([]);

  useEffect(() => {
    if (initialProject) return;
    const load = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const s = await invoke<Record<string, string>>('get_settings');
        setConfig((prev) => {
          const next = { ...prev };
          if (s.default_delay_between_requests) {
            const d = parseFloat(s.default_delay_between_requests);
            if (!isNaN(d)) next.runSettings = { ...next.runSettings, delayBetweenRequests: d };
          }
          if (s.default_max_pages) {
            const m = parseInt(s.default_max_pages, 10);
            if (!isNaN(m)) next.pagination = { ...next.pagination, maxPages: m };
          }
          if (s.default_user_agent && ['Chrome', 'Firefox', 'Safari', 'Custom'].includes(s.default_user_agent)) {
            next.runSettings = { ...next.runSettings, userAgent: s.default_user_agent as 'Chrome' | 'Firefox' | 'Safari' | 'Custom' };
          }
          return next;
        });
      } catch {}
    };
    load();
  }, []);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgress | undefined>();
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('browser');
  const [previewLoadStatus, setPreviewLoadStatus] = useState<PreviewLoadStatus>('idle');
  const [previewLoadError, setPreviewLoadError] = useState<string | undefined>();
  const [previewScreenshot, setPreviewScreenshot] =
    useState<PreviewScreenshotResult | null>(null);

  const previewUrl =
    previewLoadStatus === 'loaded' && previewScreenshot && config.url?.trim()
      ? config.url
      : undefined;

  const handleRun = useCallback(async () => {
    setScrapeError(null);

    const hasValidField = config.fields.some((f) => (f.selector || "").trim());
    if (!config.url?.trim()) {
      setScrapeError("Please enter a target URL first");
      return;
    }
    if (!hasValidField) {
      setScrapeError("Add at least one field and set a CSS selector (e.g. .titleline > a)");
      return;
    }

    setIsRunning(true);
    setProgress({
      page: 1,
      total_pages: 1,
      rows: 0,
      speed: 0,
      errors: 0,
      eta_seconds: 0,
    });
    let unlisten: (() => void) | undefined;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<ScrapeProgress>('scrape-progress', (ev) => {
        const p = ev.payload as unknown as ScrapeProgress;
        if (p) setProgress((prev) => ({ ...(prev ?? {}), ...p }));
      });
      const result = await invoke<ScrapeRow[]>('run_scrape', {
        config,
      });
      setData(result);
      setProgress(undefined);
      setScrapeError(null);
      onScrapeComplete?.(result.length, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Scrape failed:', msg);
      setScrapeError(msg);
      setProgress(undefined);
    } finally {
      unlisten?.();
      setIsRunning(false);
    }
  }, [config]);

  const autoRunDone = useRef(false);
  useEffect(() => {
    if (!autoRun || autoRunDone.current || !initialProject?.config) return;
    const hasValidField = initialProject.config.fields.some((f) => (f.selector || '').trim());
    if (!initialProject.config.url?.trim() || !hasValidField) return;
    autoRunDone.current = true;
    handleRun();
  }, [autoRun, initialProject, handleRun]);

  const handlePause = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_scrape');
    } catch (e) {
      console.error('Pause failed:', e);
    }
  }, []);

  const handleSaveProject = useCallback(async () => {
    const name = window.prompt('Project name', config.url ? new URL(config.url).hostname.replace('www.', '') : 'Untitled');
    if (!name?.trim()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const project: ScraperProject = {
        id: crypto.randomUUID(),
        name: name.trim(),
        url: config.url,
        config,
        lastRunAt: undefined,
        lastRowCount: data.length || undefined,
        fieldCount: config.fields.length,
      };
      await invoke('save_project', { project });
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [config, data.length]);

  const handleStop = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_scrape');
    } catch (e) {
      console.error('Stop failed:', e);
    }
    setIsRunning(false);
    setProgress(undefined);
  }, []);

  const handleFetchRequested = useCallback(async () => {
    const url = config.url?.trim();
    if (!url) return;
    setPreviewTab('browser');
    const result = await fetchPreviewScreenshot(url, (status, message) => {
      setPreviewLoadStatus(status);
      setPreviewLoadError(message);
    });
    setPreviewScreenshot(result ?? null);
  }, [config.url]);

  return (
    <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
      <ConfigPanel
        config={config}
        onConfigChange={setConfig}
        isRunning={isRunning}
        progress={progress}
        onRun={handleRun}
        onPause={handlePause}
        onStop={handleStop}
        onSaveProject={handleSaveProject}
        onFetchRequested={handleFetchRequested}
        previewUrl={previewUrl}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {scrapeError && (
          <div className="px-4 py-2 bg-[#E87C7C20] border-b border-[#E87C7C] text-[#E87C7C] text-sm">
            {scrapeError}
          </div>
        )}
        <PreviewPanel
          url={config.url}
          fields={config.fields.map((f) => ({ name: f.name, selector: f.selector }))}
          data={data}
          activeTab={previewTab}
          onTabChange={setPreviewTab}
          previewLoadStatus={previewLoadStatus}
          previewLoadError={previewLoadError}
          previewScreenshot={previewScreenshot}
        />
      </div>
    </div>
  );
}
