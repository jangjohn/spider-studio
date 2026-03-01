import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTheme, type ThemeMode } from '../contexts/ThemeContext';
import type { ExportFormat } from '../types';

const USER_AGENTS = ['Chrome', 'Firefox', 'Safari', 'Custom'];
const EXPORT_FORMATS: ExportFormat[] = ['CSV', 'XLSX', 'JSON'];

const SETTING_KEYS = {
  defaultExportFolder: 'default_export_folder',
  defaultExportFormat: 'default_export_format',
  defaultDelay: 'default_delay_between_requests',
  defaultMaxPages: 'default_max_pages',
  defaultUserAgent: 'default_user_agent',
} as const;

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [defaultExportFolder, setDefaultExportFolder] = useState('');
  const [defaultExportFormat, setDefaultExportFormat] = useState<ExportFormat>('CSV');
  const [defaultDelay, setDefaultDelay] = useState(1.0);
  const [defaultMaxPages, setDefaultMaxPages] = useState(50);
  const [defaultUserAgent, setDefaultUserAgent] = useState('Chrome');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const s = await invoke<Record<string, string>>('get_settings');
        if (s.default_export_folder) setDefaultExportFolder(s.default_export_folder);
        if (s.default_export_format) setDefaultExportFormat(s.default_export_format as ExportFormat);
        if (s.default_delay_between_requests) setDefaultDelay(parseFloat(s.default_delay_between_requests) || 1);
        if (s.default_max_pages) setDefaultMaxPages(parseInt(s.default_max_pages, 10) || 50);
        if (s.default_user_agent) setDefaultUserAgent(s.default_user_agent);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    load();
  }, []);

  const handleBrowse = async () => {
    try {
      const selected = await open({ directory: true });
      if (selected) setDefaultExportFolder(selected);
    } catch (e) {
      console.error('Browse failed:', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_settings', {
        settings: {
          [SETTING_KEYS.defaultExportFolder]: defaultExportFolder,
          [SETTING_KEYS.defaultExportFormat]: defaultExportFormat,
          [SETTING_KEYS.defaultDelay]: String(defaultDelay),
          [SETTING_KEYS.defaultMaxPages]: String(defaultMaxPages),
          [SETTING_KEYS.defaultUserAgent]: defaultUserAgent,
          theme,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-xl space-y-8">
        <section>
          <h2 className="text-lg font-medium text-[var(--color-primary)] mb-4">Theme</h2>
          <div className="flex gap-4">
            {(['dark', 'light'] as ThemeMode[]).map((t) => (
              <motion.button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex items-center gap-3 px-4 py-3 rounded-[14px] border-2 transition-colors
                  ${theme === t
                  ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-muted)]'
                }`}
              >
                {t === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <span className="font-medium capitalize">{t}</span>
              </motion.button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-[var(--color-primary)] mb-4">Defaults</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--color-secondary)] mb-2">
                Default export folder
              </label>
              <div className="flex gap-2">
                <input
                  value={defaultExportFolder}
                  onChange={(e) => setDefaultExportFolder(e.target.value)}
                  placeholder="Leave empty for system default"
                  className="flex-1 py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                    text-[var(--color-primary)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  onClick={handleBrowse}
                  className="px-4 py-2.5 rounded-[10px] bg-[var(--color-elevated)] border border-[var(--color-border)]
                    text-[var(--color-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/50 transition-colors
                    flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-[var(--color-secondary)] mb-2">
                Default export format
              </label>
              <select
                value={defaultExportFormat}
                onChange={(e) => setDefaultExportFormat(e.target.value as ExportFormat)}
                className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                  text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                {EXPORT_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[var(--color-secondary)] mb-2">
                Default delay between requests (s)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={defaultDelay}
                onChange={(e) => setDefaultDelay(parseFloat(e.target.value) || 1)}
                className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                  text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--color-secondary)] mb-2">
                Default max pages
              </label>
              <input
                type="number"
                min={1}
                value={defaultMaxPages}
                onChange={(e) => setDefaultMaxPages(parseInt(e.target.value, 10) || 50)}
                className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                  text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--color-secondary)] mb-2">
                Default user agent
              </label>
              <select
                value={defaultUserAgent}
                onChange={(e) => setDefaultUserAgent(e.target.value)}
                className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                  text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                {USER_AGENTS.map((ua) => (
                  <option key={ua} value={ua}>{ua}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-[10px] bg-[var(--color-accent)] text-white font-medium
            hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
