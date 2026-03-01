import { BrowserPreview } from './BrowserPreview';
import { DataPreview } from './DataPreview';
import type { ScrapeRow } from '../../types';
import type { PreviewLoadStatus, PreviewScreenshotResult } from '../../lib/previewWindow';

export type PreviewTab = 'browser' | 'data';

interface PreviewPanelProps {
  url: string;
  fields: { name: string; selector: string }[];
  data: ScrapeRow[];
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  previewLoadStatus: PreviewLoadStatus;
  previewLoadError?: string;
  previewScreenshot?: PreviewScreenshotResult | null;
}

export function PreviewPanel({
  url,
  fields,
  data,
  activeTab,
  onTabChange,
  previewLoadStatus,
  previewLoadError,
  previewScreenshot,
}: PreviewPanelProps) {
  return (
    <div className="flex-1 flex flex-col bg-[var(--color-base)] min-w-0">
      <div className="flex border-b border-[var(--color-border)] px-4">
        <button
          onClick={() => onTabChange('browser')}
          className={`py-3 px-4 text-sm font-medium transition-colors duration-100 border-b-2 -mb-px
            ${activeTab === 'browser'
              ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
              : 'text-[var(--color-secondary)] border-transparent hover:text-[var(--color-primary)]'
            }`}
        >
          Browser Preview
        </button>
        <button
          onClick={() => onTabChange('data')}
          className={`py-3 px-4 text-sm font-medium transition-colors duration-100 border-b-2 -mb-px
            ${activeTab === 'data'
              ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
              : 'text-[var(--color-secondary)] border-transparent hover:text-[var(--color-primary)]'
            }`}
        >
          Data Preview
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'browser' ? (
          <BrowserPreview
            url={url}
            fields={fields}
            loadStatus={previewLoadStatus}
            loadError={previewLoadError}
            screenshot={previewScreenshot}
          />
        ) : (
          <DataPreview data={data} />
        )}
      </div>
    </div>
  );
}
