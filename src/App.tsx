import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { save } from '@tauri-apps/plugin-dialog';
import { Sidebar } from './components/Sidebar';
import { ProjectsView } from './views/ProjectsView';
import { ScraperView } from './views/ScraperView';
import { ExportsView } from './views/ExportsView';
import { SettingsView } from './views/SettingsView';
import { ExportModal } from './components/ExportModal';
import type { ScraperProject, ExportFormat } from './types';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { project?: ScraperProject; autoRun?: boolean } | null;
  const project = routeState?.project;
  const autoRun = routeState?.autoRun ?? false;
  const [projects, setProjects] = useState<ScraperProject[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportRowCount, setExportRowCount] = useState(0);
  const [exportData, setExportData] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (location.pathname === '/') {
      loadProjects();
    }
  }, [location.pathname]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        unlisten = await listen<[string, number]>('scheduled-run-complete', async (ev) => {
          const [name, rows] = ev.payload;
          let granted = await isPermissionGranted();
          if (!granted) granted = (await requestPermission()) === 'granted';
          if (granted) {
            sendNotification({ title: 'Spider Studio', body: `${name}: Scrape complete. ${rows} rows saved.` });
          }
          loadProjects();
        });
      } catch {}
    };
    setup();
    return () => unlisten?.();
  }, []);

  const loadProjects = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list = await invoke<ScraperProject[]>('list_projects');
      setProjects(list);
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
  };

  const handleSelectProject = (project: ScraperProject) => {
    navigate('/scrape', { state: { project } });
  };

  const handleRunProject = (project: ScraperProject) => {
    navigate('/scrape', { state: { project, autoRun: true } });
  };

  const handleExport = async (
    format: ExportFormat,
    options: { includeHeaders: boolean; autoOpenAfterExport: boolean; splitIntoFilesOf?: number; filename: string }
  ): Promise<boolean> => {
    const ext = format === 'CSV' ? 'csv' : format === 'XLSX' ? 'xlsx' : 'json';
    const baseName = `${options.filename}.${ext}`;
    let defaultPath = baseName;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const s = await invoke<Record<string, string>>('get_settings');
      const folder = s?.default_export_folder;
      if (folder) defaultPath = `${folder.replace(/[/\\]$/, '')}/${baseName}`;
    } catch {}
    const filters = format === 'CSV'
      ? [{ name: 'CSV', extensions: ['csv'] }]
      : format === 'XLSX'
      ? [{ name: 'Excel', extensions: ['xlsx'] }]
      : [{ name: 'JSON', extensions: ['json'] }];

    let selectedPath: string | null;
    try {
      selectedPath = await save({ defaultPath, filters });
    } catch (e) {
      console.warn('Save dialog unavailable, using default folder:', e);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const savedPath = await invoke<string>('export_data', {
          format,
          options,
          data: exportData,
          pathOverride: undefined,
        });
        loadProjects();
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === 'granted';
        if (granted) sendNotification({ title: '已导出', body: `文件已保存至: ${savedPath}` });
        return true;
      } catch (fallbackErr) {
        console.error('Export failed:', fallbackErr);
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === 'granted';
        if (granted) sendNotification({ title: '导出失败', body: String(fallbackErr) });
        return false;
      }
    }
    if (selectedPath == null) return false;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('export_data', { format, options, data: exportData, pathOverride: selectedPath });
      loadProjects();
      return true;
    } catch (e) {
      console.error('Export failed:', e);
      try {
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === 'granted';
        if (granted) {
          sendNotification({ title: '导出失败', body: String(e) });
        }
      } catch {}
      return false;
    }
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <ProjectsView
              projects={projects}
              onSelectProject={handleSelectProject}
              onRunProject={handleRunProject}
              onScheduleSave={async (project) => {
                try {
                  const { invoke } = await import('@tauri-apps/api/core');
                  await invoke('save_project', { project });
                  loadProjects();
                } catch (e) {
                  console.error('Save schedule failed:', e);
                }
              }}
            />
          }
        />
        <Route
          path="/quick-scrape"
          element={
            <ScraperView
              initialProject={null}
              onScrapeComplete={(n, data) => {
                setExportRowCount(n);
                setExportData(data);
                setExportModalOpen(true);
              }}
            />
          }
        />
        <Route
          path="/scrape"
          element={
            <ScraperView
              initialProject={project ?? null}
              autoRun={autoRun}
              onScrapeComplete={(n, data) => {
                setExportRowCount(n);
                setExportData(data);
                setExportModalOpen(true);
              }}
            />
          }
        />
        <Route path="/exports" element={<ExportsView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Routes>

      <ExportModal
        open={exportModalOpen}
        rowCount={exportRowCount}
        data={exportData}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </>
  );
}

export default function App() {
  return (
    <div className="h-screen flex bg-[var(--color-base)]">
      <BrowserRouter>
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppContent />
        </main>
      </BrowserRouter>
    </div>
  );
}
