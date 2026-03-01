import { invoke } from '@tauri-apps/api/core';

export type PreviewLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface PreviewScreenshotResult {
  base64: string;
  width: number;
  height: number;
}

export async function fetchPreviewScreenshot(
  url: string,
  onStatus: (status: PreviewLoadStatus, message?: string) => void
): Promise<PreviewScreenshotResult | null> {
  onStatus('loading');
  try {
    const result = await invoke<PreviewScreenshotResult>('preview_screenshot', {
      url,
    });
    onStatus('loaded');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onStatus('error', msg);
    return null;
  }
}

export async function getElementSelectorAtPoint(
  url: string,
  x: number,
  y: number
): Promise<string> {
  return invoke<string>('get_element_selector', { url, x, y });
}

export async function countSelectorMatches(
  url: string,
  selector: string
): Promise<number> {
  return invoke<number>('count_selector_matches', { url, selector });
}
