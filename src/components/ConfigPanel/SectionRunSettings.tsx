import { motion, AnimatePresence } from 'framer-motion';
import type {
  ScraperConfig,
  UserAgentPreset,
} from '../../types';

interface SectionRunSettingsProps {
  config: ScraperConfig;
  onConfigChange: (config: ScraperConfig) => void;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete: (section: number) => void;
}

const USER_AGENTS: UserAgentPreset[] = ['Chrome', 'Firefox', 'Safari', 'Custom'];

export function SectionRunSettings({
  config,
  onConfigChange,
  isExpanded,
  onToggle,
}: SectionRunSettingsProps) {
  const { runSettings } = config;

  const updateSettings = (updates: Partial<typeof runSettings>) => {
    onConfigChange({
      ...config,
      runSettings: { ...runSettings, ...updates },
    });
  };

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 rounded-[14px] bg-[var(--color-elevated)]
          hover:bg-[var(--color-border)]/50 transition-colors duration-100 text-left"
      >
        <span className="font-medium text-[var(--color-primary)]">4. Run Settings</span>
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
              <div>
                <label className="block text-sm text-[var(--color-secondary)] mb-2">
                  Delay between requests (s)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={runSettings.delayBetweenRequests}
                  onChange={(e) =>
                    updateSettings({
                      delayBetweenRequests: parseFloat(e.target.value) || 1,
                    })
                  }
                  className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                    text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--color-secondary)] mb-2">
                  Retry on failure
                </label>
                <input
                  type="number"
                  min={0}
                  value={runSettings.retryOnFailure}
                  onChange={(e) =>
                    updateSettings({ retryOnFailure: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--color-base)] border border-[var(--color-border)]
                    text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-secondary)]">Respect robots.txt</label>
                <button
                  onClick={() =>
                    updateSettings({ respectRobotsTxt: !runSettings.respectRobotsTxt })
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors duration-100
                    ${runSettings.respectRobotsTxt ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-100
                      ${runSettings.respectRobotsTxt ? 'left-6' : 'left-1'}`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm text-[#9E9BB5] mb-2">
                  User agent
                </label>
                <select
                  value={runSettings.userAgent}
                  onChange={(e) =>
                    updateSettings({ userAgent: e.target.value as UserAgentPreset })
                  }
                  className="w-full py-2.5 px-4 rounded-[10px] bg-[#1C1B22] border border-[#353347]
                    text-[#E8E6F0] focus:outline-none focus:border-[#7C6FF7]"
                >
                  {USER_AGENTS.map((ua) => (
                    <option key={ua} value={ua}>
                      {ua}
                    </option>
                  ))}
                </select>
                <AnimatePresence>
                  {runSettings.userAgent === 'Custom' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 overflow-hidden"
                    >
                      <input
                        value={runSettings.customUserAgent ?? ''}
                        onChange={(e) =>
                          updateSettings({ customUserAgent: e.target.value })
                        }
                        placeholder="Custom user agent string"
                        className="w-full py-2 px-3 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                          text-[var(--color-primary)] font-mono text-xs placeholder-[var(--color-muted)]
                          focus:outline-none focus:border-[var(--color-accent)]"
                      />
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
