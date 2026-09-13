import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEditor } from '@/store/editorStore';
import { useUI, resolveTheme } from '@/store/uiStore';
import { exportJSON, exportPNG, exportReport } from '@/utils/exporters';
import { Icon } from './Icon';
import { Button, IconButton, Segmented, Tooltip } from './primitives';

/**
 * Top bar: identity on the left, history in the middle, output on the right.
 *
 * The save indicator is a real state machine, not decoration — Saved / Saving /
 * Save failed / Offline each mean something different to a user deciding
 * whether it is safe to close the tab, and "Save failed" is the one that has to
 * be impossible to miss.
 */

function SaveIndicator() {
  const status = useEditor((s) => s.saveStatus);
  const openModal = useUI((s) => s.openModal);

  const config = {
    saved: { icon: 'check', text: 'All changes saved', className: 'text-ink-400' },
    saving: { icon: 'cloud-off', text: 'Saving…', className: 'text-ink-400' },
    offline: { icon: 'cloud-off', text: 'Offline — saved locally', className: 'text-warn' },
    failed: { icon: 'alert', text: 'Save failed', className: 'text-danger' },
  } as const;

  const c = config[status];

  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={() => openModal('about')}
        className="flex items-center gap-1.5 rounded-control bg-danger/10 px-2 py-1 text-caption font-medium text-danger transition-colors duration-150 hover:bg-danger/15"
      >
        <Icon name="alert" className="h-3.5 w-3.5" />
        Save failed — export a backup
      </button>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={clsx('flex items-center gap-1.5 text-caption', c.className)}
    >
      <Icon name={c.icon} className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">{c.text}</span>
    </span>
  );
}

function RoomName() {
  const name = useEditor((s) => s.doc.name);
  const rename = useEditor((s) => s.rename);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) rename(trimmed);
    else setDraft(name);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label="Room name"
        className="h-8 w-56 rounded-control border border-sage-500 bg-white px-2 text-body font-medium dark:bg-ink-800 dark:text-sage-50"
      />
    );
  }

  return (
    <Tooltip content="Click to rename">
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="max-w-[16rem] truncate rounded-control px-2 py-1 text-body font-medium text-ink-900 transition-colors duration-150 hover:bg-ink-100 dark:text-sage-50 dark:hover:bg-ink-800"
      >
        {name}
      </button>
    </Tooltip>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toProject = useEditor((s) => s.toProject);
  const toast = useUI((s) => s.toast);
  const currency = useUI((s) => s.currency);
  const openModal = useUI((s) => s.openModal);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (label: string, fn: () => { ok: boolean; error?: string }) => {
    setOpen(false);
    const result = fn();
    if (result.ok) toast(`${label} exported`, { tone: 'success' });
    else toast(`${label} export failed`, { description: result.error, tone: 'error' });
  };

  const items: Array<{ label: string; description: string; onClick: () => void }> = [
    {
      label: 'PNG image',
      description: '2× resolution, 3D view only',
      onClick: () => run('PNG', () => exportPNG(toProject(), 2)),
    },
    {
      label: 'Project file (JSON)',
      description: 'Lossless backup you can re-import',
      onClick: () => run('Project', () => exportJSON(toProject())),
    },
    {
      label: 'Design report',
      description: 'Printable page with plan and costs',
      onClick: () =>
        run('Report', () => exportReport(toProject(), { currency })),
    },
    {
      label: 'Import project…',
      description: 'Restore from a JSON backup',
      onClick: () => {
        setOpen(false);
        openModal('import');
      },
    },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        icon="download"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-panel border border-ink-200 bg-white shadow-medium dark:border-ink-800 dark:bg-ink-900"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={item.onClick}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <span className="text-caption font-medium text-ink-800 dark:text-sage-50">
                  {item.label}
                </span>
                <span className="text-[11px] text-ink-400">{item.description}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopBar() {
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);

  const setScreen = useUI((s) => s.setScreen);
  const viewMode = useUI((s) => s.viewMode);
  const setViewMode = useUI((s) => s.setViewMode);
  const viewerMode = useUI((s) => s.viewerMode);
  const setViewerMode = useUI((s) => s.setViewerMode);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const openModal = useUI((s) => s.openModal);
  const setPresentation = useUI((s) => s.setPresentationMode);
  const toast = useUI((s) => s.toast);

  const nextUndo = past[past.length - 1];
  const nextRedo = future[future.length - 1];
  const isDark = resolveTheme(theme) === 'dark';

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink-200 bg-white px-3 shadow-subtle dark:border-ink-800 dark:bg-ink-900">
      {/* Left: identity */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <IconButton
          icon="home"
          label="Back to all projects"
          onClick={() => setScreen('dashboard')}
        />
        <span className="mx-1 h-5 w-px bg-ink-200 dark:bg-ink-800" />
        <RoomName />
      </div>

      {/* Centre: history + save state, grouped */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 rounded-control bg-ink-100 p-0.5 dark:bg-ink-800">
          <IconButton
            size="sm"
            icon="undo"
            label={nextUndo ? `Undo ${nextUndo.label}` : 'Nothing to undo'}
            disabled={past.length === 0}
            onClick={() => {
              const label = undo();
              if (label) toast(`Undid ${label.toLowerCase()}`);
            }}
          />
          <IconButton
            size="sm"
            icon="redo"
            label={nextRedo ? `Redo ${nextRedo.label}` : 'Nothing to redo'}
            disabled={future.length === 0}
            onClick={() => {
              const label = redo();
              if (label) toast(`Redid ${label.toLowerCase()}`);
            }}
          />
        </div>
        <SaveIndicator />
      </div>

      {/* Right: view + output */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <Segmented
          size="sm"
          label="View mode"
          value={viewMode}
          options={[
            { value: '3d', label: '3D', icon: 'cube' },
            { value: '2d', label: '2D', icon: 'grid' },
            { value: 'walk', label: 'Walk', icon: 'walk' },
          ]}
          onChange={setViewMode}
        />
        <IconButton
          icon="eye"
          active={viewerMode}
          label={viewerMode ? 'Viewer Mode (Read-only) — Click to edit' : 'Edit Mode — Click for Read-only Viewer'}
          onClick={() => {
            const next = !viewerMode;
            setViewerMode(next);
            toast(next ? 'Viewer Mode enabled' : 'Edit Mode enabled', {
              description: next
                ? 'Tap items to inspect without dragging.'
                : 'Full editing enabled.',
            });
          }}
        />
        <IconButton
          icon={isDark ? 'sun' : 'moon'}
          label={isDark ? 'Switch to light interface' : 'Switch to dark interface'}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        />
        <IconButton
          icon="present"
          label="Presentation mode"
          onClick={() => {
            setPresentation(true);
            toast('Presentation mode', { description: 'Press Escape to exit.' });
          }}
        />
        <IconButton icon="share" label="Share this room" onClick={() => openModal('share')} />
        <ExportMenu />
      </div>
    </header>
  );
}
