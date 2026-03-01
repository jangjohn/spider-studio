import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScraperConfig, HeaderPair, HttpMethod, ScraperField } from '../../types';

const EXAMPLES: {
  name: string;
  url: string;
  rowContainerSelector?: string;
  fields: Omit<ScraperField, 'id'>[];
}[] = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com', fields: [{ name: 'title', selector: '.titleline > a', dataType: 'Text', cleaningRule: 'None' }, { name: 'points', selector: '.score', dataType: 'Text', cleaningRule: 'None' }] },
  { name: 'Books to Scrape', url: 'https://books.toscrape.com', rowContainerSelector: '.product_pod', fields: [{ name: 'title', selector: 'h3 a', dataType: 'Text', cleaningRule: 'None' }, { name: 'price', selector: '.price_color', dataType: 'Text', cleaningRule: 'None' }] },
  { name: 'Quotes to Scrape', url: 'https://quotes.toscrape.com', rowContainerSelector: '.quote', fields: [{ name: 'quote', selector: '.text', dataType: 'Text', cleaningRule: 'None' }, { name: 'author', selector: '.author', dataType: 'Text', cleaningRule: 'None' }, { name: 'tags', selector: '.tag', dataType: 'Text', cleaningRule: 'None' }] },
];

interface SectionTargetProps {
  config: ScraperConfig;
  onConfigChange: (config: ScraperConfig) => void;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete: (section: number) => void;
  onFetchRequested?: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2);
}

export function SectionTarget({
  config,
  onConfigChange,
  isExpanded,
  onToggle,
  onComplete,
  onFetchRequested,
}: SectionTargetProps) {
  const [headersExpanded, setHeadersExpanded] = useState(false);
  const [exampleDropdownOpen, setExampleDropdownOpen] = useState(false);
  const exampleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exampleDropdownRef.current && !exampleDropdownRef.current.contains(e.target as Node)) {
        setExampleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadExample = (example: (typeof EXAMPLES)[0]) => {
    onConfigChange({
      ...config,
      url: example.url,
      rowContainerSelector: example.rowContainerSelector,
      fields: example.fields.map((f) => ({ ...f, id: generateId() })),
    });
    setExampleDropdownOpen(false);
  };

  const handleUrlChange = (url: string) => {
    onConfigChange({ ...config, url });
  };

  const handleMethodChange = (method: HttpMethod) => {
    onConfigChange({ ...config, method });
  };

  const handleFetch = async () => {
    if (onFetchRequested) {
      await onFetchRequested();
      onComplete(1);
    }
  };

  const handleHeaderChange = (id: string, updates: Partial<HeaderPair>) => {
    const headers = config.headers.map((h) =>
      h.id === id ? { ...h, ...updates } : h
    );
    onConfigChange({ ...config, headers });
  };

  const addHeader = () => {
    onConfigChange({
      ...config,
      headers: [...config.headers, { id: generateId(), key: '', value: '' }],
    });
  };

  const removeHeader = (id: string) => {
    onConfigChange({
      ...config,
      headers: config.headers.filter((h) => h.id !== id),
    });
  };

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 rounded-[14px] bg-[var(--color-elevated)]
          hover:bg-[var(--color-border)]/50 transition-colors duration-100 text-left"
      >
        <span className="font-medium text-[var(--color-primary)]">1. Target</span>
        <span className="text-[var(--color-muted)]">
          {isExpanded ? '−' : '+'}
        </span>
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
              <div>
                <label className="block text-sm text-[var(--color-secondary)] mb-2">URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={config.url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                      text-[var(--color-primary)] placeholder-[var(--color-muted)] font-mono text-sm focus:outline-none
                      focus:border-[var(--color-accent)] transition-colors duration-100"
                  />
                  <button
                    onClick={handleFetch}
                    className="py-2.5 px-4 rounded-[10px] bg-[var(--color-accent)] text-white text-sm font-medium
                      hover:bg-[#8b7ff8] transition-colors duration-100"
                  >
                    Fetch
                  </button>
                </div>
              </div>

              <div className="relative" ref={exampleDropdownRef}>
                <button
                  onClick={() => setExampleDropdownOpen((o) => !o)}
                  className="w-full py-2 px-4 rounded-[10px] border border-dashed border-[var(--color-border)]
                    text-[var(--color-accent)] text-sm font-medium hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]
                    transition-colors duration-100"
                >
                  Load Example
                </button>
                <AnimatePresence>
                  {exampleDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-1 py-1 rounded-[10px] bg-[var(--color-elevated)]
                        border border-[var(--color-border)] shadow-lg z-10"
                    >
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex.name}
                          onClick={() => loadExample(ex)}
                          className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-primary)]
                            hover:bg-[var(--color-border)] transition-colors duration-100 first:rounded-t-[9px] last:rounded-b-[9px]"
                        >
                          {ex.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-secondary)] mb-2">Method</label>
                <div className="flex gap-2">
                  {(['GET', 'POST'] as HttpMethod[]).map((method) => (
                    <button
                      key={method}
                      onClick={() => handleMethodChange(method)}
                      className={`flex-1 py-2 px-4 rounded-[10px] text-sm font-medium transition-colors duration-100 border
                        ${config.method === method
                          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]'
                          : 'bg-[var(--color-elevated)] text-[var(--color-secondary)] border-[var(--color-border)] hover:border-[var(--color-muted)]'
                        }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => setHeadersExpanded(!headersExpanded)}
                  className="flex items-center justify-between w-full py-2 text-sm text-[var(--color-secondary)]"
                >
                  Headers
                  <span>{headersExpanded ? '−' : '+'}</span>
                </button>
                <AnimatePresence>
                  {headersExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2"
                    >
                      {config.headers.map((h) => (
                        <div key={h.id} className="flex gap-2">
                          <input
                            value={h.key}
                            onChange={(e) => handleHeaderChange(h.id, { key: e.target.value })}
                            placeholder="Key"
                            className="flex-1 py-2 px-3 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                              text-[var(--color-primary)] font-mono text-xs focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <input
                            value={h.value}
                            onChange={(e) => handleHeaderChange(h.id, { value: e.target.value })}
                            placeholder="Value"
                            className="flex-1 py-2 px-3 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                              text-[var(--color-primary)] font-mono text-xs focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <button
                            onClick={() => removeHeader(h.id)}
                            className="p-2 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 rounded-[6px]"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addHeader}
                        className="text-sm text-[var(--color-accent)] hover:opacity-90"
                      >
                        + Add row
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
