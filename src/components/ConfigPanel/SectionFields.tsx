import { motion, AnimatePresence } from 'framer-motion';
import { SelectorValidator } from './SelectorValidator';
import type {
  ScraperConfig,
  ScraperField,
  FieldDataType,
  CleaningRule,
} from '../../types';

interface SectionFieldsProps {
  config: ScraperConfig;
  onConfigChange: (config: ScraperConfig) => void;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete: (section: number) => void;
  previewUrl?: string;
}

function generateId() {
  return Math.random().toString(36).slice(2);
}

const DATA_TYPES: FieldDataType[] = ['Text', 'Number', 'Link', 'Image'];
const CLEANING_RULES: CleaningRule[] = [
  'None',
  'Trim',
  'Remove currency',
  'Extract numbers',
];

export function SectionFields({
  config,
  onConfigChange,
  isExpanded,
  onToggle,
  previewUrl,
}: SectionFieldsProps) {
  const addField = () => {
    onConfigChange({
      ...config,
      fields: [
        ...config.fields,
        {
          id: generateId(),
          name: '',
          selector: '',
          dataType: 'Text',
          cleaningRule: 'None',
        },
      ],
    });
  };

  const updateField = (id: string, updates: Partial<ScraperField>) => {
    const fields = config.fields.map((f) =>
      f.id === id ? { ...f, ...updates } : f
    );
    onConfigChange({ ...config, fields });
  };

  const removeField = (id: string) => {
    onConfigChange({
      ...config,
      fields: config.fields.filter((f) => f.id !== id),
    });
  };

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 rounded-[14px] bg-[var(--color-elevated)]
          hover:bg-[var(--color-border)]/50 transition-colors duration-100 text-left"
      >
        <span className="font-medium text-[var(--color-primary)]">2. Fields</span>
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
                <label className="block text-sm text-[var(--color-secondary)] mb-2">Row container selector (optional)</label>
                <input
                  value={config.rowContainerSelector ?? ''}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      rowContainerSelector: e.target.value.trim() || undefined,
                    })
                  }
                  placeholder="e.g. .quote"
                  className="w-full py-2 px-3 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                    text-[var(--color-primary)] font-mono text-xs placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Extract fields within each container for correct row alignment. Leave empty for flat extraction.
                </p>
              </div>
              <button
                onClick={addField}
                className="w-full py-2.5 px-4 rounded-[10px] border border-dashed border-[var(--color-border)]
                  text-[var(--color-accent)] text-sm font-medium hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]
                  transition-colors duration-100"
              >
                + Add Field
              </button>

              <div className="space-y-3">
                {config.fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="p-4 rounded-[14px] bg-[var(--color-elevated)] border border-[var(--color-border)]/50
                      space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                        placeholder={`Field ${idx + 1}`}
                        className="flex-1 py-2 px-3 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                          text-[var(--color-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                      />
                      <button
                        onClick={() => removeField(field.id)}
                        className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-error)] rounded-[6px]"
                      >
                        ×
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        value={field.selector}
                        onChange={(e) => updateField(field.id, { selector: e.target.value })}
                        placeholder="e.g. .titleline > a"
                        className="w-full py-2 px-3 pr-24 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                          text-[var(--color-primary)] font-mono text-xs placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                      />
                      {previewUrl && (
                        <SelectorValidator
                          selector={field.selector}
                          previewUrl={previewUrl}
                        />
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={field.dataType}
                        onChange={(e) =>
                          updateField(field.id, { dataType: e.target.value as FieldDataType })
                        }
                        className="py-2 px-3 rounded-[6px] bg-[#1C1B22] border border-[#353347]
                          text-[#E8E6F0] text-xs font-mono focus:outline-none focus:border-[#7C6FF7]"
                      >
                        {DATA_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <select
                        value={field.cleaningRule}
                        onChange={(e) =>
                          updateField(field.id, {
                            cleaningRule: e.target.value as CleaningRule,
                          })
                        }
                        className="py-2 px-3 rounded-[6px] bg-[var(--color-base)] border border-[var(--color-border)]
                          text-[var(--color-primary)] text-xs focus:outline-none focus:border-[var(--color-accent)]"
                      >
                        {CLEANING_RULES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
