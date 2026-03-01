import { useState } from 'react';
import { motion } from 'framer-motion';
import { IconFolder, IconFolderLarge, IconClock } from '../components/Icons';
import { ScheduleModal } from '../components/ScheduleModal';
import type { ScraperProject } from '../types';

interface ProjectsViewProps {
  projects: ScraperProject[];
  onSelectProject: (project: ScraperProject) => void;
  onRunProject: (project: ScraperProject) => void;
  onScheduleSave?: (project: ScraperProject) => void;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return d.toLocaleDateString();
}

export function ProjectsView({
  projects,
  onSelectProject,
  onRunProject,
  onScheduleSave,
}: ProjectsViewProps) {
  const [scheduleProject, setScheduleProject] = useState<ScraperProject | null>(null);
  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <IconFolderLarge className="w-16 h-16 mb-4 text-[#9E9BB5]" />
        <p className="text-[#9E9BB5] text-center max-w-sm">
          No projects yet — start a Quick Scrape to create one
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-2 gap-4 max-w-4xl">
        {projects.map((project) => (
          <motion.div
            key={project.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative p-5 rounded-[14px] bg-[#242330] border border-[#353347] cursor-pointer
              hover:border-[#7C6FF7]/50 transition-colors duration-100 shadow-[0_4px_12px_#0D0C1460]"
            onClick={() => onSelectProject(project)}
          >
            {project.schedule?.enabled && project.schedule?.frequency !== 'none' && (
              <div
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#7C6FF7]/30 flex items-center justify-center"
                title="Scheduled"
              >
                <IconClock className="w-3.5 h-3.5 text-[#7C6FF7]" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2 mb-2">
              <IconFolder className="w-5 h-5 text-[#9E9BB5]" />
              <div className="flex gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setScheduleProject(project);
                  }}
                  className="py-1.5 px-2.5 rounded-[10px] bg-[#2C2A3A] border border-[#353347]
                    text-[#9E9BB5] hover:text-[#E8E6F0] hover:border-[#7C6FF7]/50 transition-colors"
                  title="Schedule"
                >
                  <IconClock className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRunProject(project);
                  }}
                  className="py-1.5 px-3 rounded-[10px] bg-[#7C6FF7] text-white text-xs font-medium
                    hover:bg-[#8b7ff8] transition-colors duration-100"
                >
                  Run
                </button>
              </div>
            </div>
            <h3 className="font-medium text-[#E8E6F0] mb-1">{project.name}</h3>
            <p className="text-xs text-[#635F7A] font-mono truncate mb-2">
              {project.url}
            </p>
            <p className="text-xs text-[#9E9BB5]">
              Last run {formatRelativeTime(project.lastRunAt)}
            </p>
            <p className="text-xs text-[#9E9BB5] mt-0.5">
              {project.lastRowCount?.toLocaleString() ?? '—'} rows · {project.fieldCount} fields
            </p>
          </motion.div>
        ))}
      </div>

      {scheduleProject && (
        <ScheduleModal
          project={scheduleProject}
          open={!!scheduleProject}
          onClose={() => setScheduleProject(null)}
          onSave={(updated) => {
            onScheduleSave?.(updated);
            setScheduleProject(null);
          }}
        />
      )}
    </div>
  );
}
