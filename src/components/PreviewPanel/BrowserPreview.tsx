import { useRef } from 'react';
import type { PreviewLoadStatus, PreviewScreenshotResult } from '../../lib/previewWindow';

interface BrowserPreviewProps {
  url: string;
  fields: { name: string; selector: string }[];
  loadStatus: PreviewLoadStatus;
  loadError?: string;
  screenshot?: PreviewScreenshotResult | null;
}

function truncateUrl(url: string, maxLen = 50) {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}

export function BrowserPreview({
  url,
  loadStatus,
  loadError,
  screenshot,
}: BrowserPreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  if (!url) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[var(--color-muted)]">Fetch a URL to see preview</p>
        </div>
      </div>
    );
  }

  const imageSrc = screenshot?.base64
    ? `data:image/png;base64,${screenshot.base64}`
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <span className="font-mono text-xs text-[var(--color-secondary)] truncate" title={url}>
          {truncateUrl(url)}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {loadStatus === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[var(--color-secondary)] text-sm">Taking screenshot...</p>
          </div>
        )}
        {loadStatus === 'error' && (
          <div className="flex flex-col items-center justify-center max-w-md text-center p-4">
            <p className="text-[#E87C7C] mb-2">Failed to load preview</p>
            <p className="text-sm text-[#635F7A]">{loadError}</p>
          </div>
        )}
        {loadStatus === 'loaded' && imageSrc && (
          <div className="w-full h-full flex items-center justify-center min-h-0">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Page preview"
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
        )}
        {loadStatus === 'idle' && (
          <div className="flex items-center justify-center flex-1 w-full">
            <p className="text-[var(--color-muted)]">Click Fetch to load the URL</p>
          </div>
        )}
      </div>
    </div>
  );
}
