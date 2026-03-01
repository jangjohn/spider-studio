import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { IconFolder, IconBolt, IconExport } from './Icons';

const navItems = [
  { path: '/', Icon: IconFolder, label: 'Projects' },
  { path: '/quick-scrape', Icon: IconBolt, label: 'Quick Scrape' },
  { path: '/exports', Icon: IconExport, label: 'Exports' },
  { path: '/settings', Icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="w-20 min-w-[80px] bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col items-center py-4 shrink-0">
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ path, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `w-12 h-12 rounded-[10px] flex items-center justify-center transition-all duration-100 hover:bg-[var(--color-elevated)]
              ${isActive ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-secondary)]'}`
            }
          >
            <motion.span
              className="flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.1 }}
            >
              <Icon className="w-6 h-6" />
            </motion.span>
          </NavLink>
        ))}
      </nav>
      <div className="text-[10px] text-[var(--color-muted)] pt-4">
        v0.1.0
      </div>
    </aside>
  );
}
