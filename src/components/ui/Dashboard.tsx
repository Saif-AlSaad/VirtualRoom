import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { Project } from '@/types';
import { useProjects } from '@/store/projectsStore';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { ROOM_TEMPLATES } from '@/data/catalog';
import { createProject } from '@/utils/schema';
import { parseProjectJSON } from '@/utils/schema';
import { readAutosave, clearAutosave, estimateUsage } from '@/utils/storage';
import { readFileAsText } from '@/utils/exporters';
import { formatArea, formatLengthShort } from '@/utils/units';
import { M_PER_FT } from '@/utils/units';
import { ROOM_LIMITS } from '@/utils/placement';
import { createRoomFromFeet } from '@/utils/roomCreation';
import { Icon } from './Icon';
import { Button, EmptyState, IconButton, TextField, Tooltip } from './primitives';
import { ConfirmDialog, Modal } from './Modal';

/**
 * Project dashboard — create, open, duplicate, rename, delete.
 *
 * Also the home for recovery: if an autosave exists that is newer than any
 * saved project, it is offered here rather than silently restored. Silently
 * replacing what someone last saved with a crash artefact is how you lose
 * people's trust in a tool that owns their data.
 */

function timeAgo(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString();
}

function ProjectCard({
  id,
  name,
  updatedAt,
  furnitureCount,
  width,
  length,
  unit,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
}: {
  id: string;
  name: string;
  updatedAt: number;
  furnitureCount: number;
  width: number;
  length: number;
  unit: string;
  onOpen: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayUnit = unit === 'ft' ? 'ft' : 'm';

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Proportional plan thumbnail, so cards are distinguishable at a glance.
  const aspect = width / length;
  const thumbW = aspect >= 1 ? 78 : 78 * aspect;
  const thumbH = aspect >= 1 ? 78 / aspect : 78;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-panel border border-ink-200 bg-white transition-all duration-150 ease-out hover:border-sage-400 hover:shadow-medium dark:border-ink-800 dark:bg-ink-900">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${name}`}
        className="flex aspect-[4/3] w-full items-center justify-center bg-sage-50 dark:bg-ink-800"
      >
        <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden="true">
          <rect
            x={50 - thumbW / 2}
            y={50 - thumbH / 2}
            width={thumbW}
            height={thumbH}
            rx="3"
            className="fill-white stroke-sage-600 dark:fill-ink-900"
            strokeWidth="2"
          />
          {Array.from({ length: Math.min(furnitureCount, 7) }, (_, i) => (
            <rect
              key={i}
              x={50 - thumbW / 2 + 6 + (i % 3) * (thumbW / 3.4)}
              y={50 - thumbH / 2 + 6 + Math.floor(i / 3) * (thumbH / 3.4)}
              width={thumbW / 4.6}
              height={thumbH / 5.4}
              rx="1.5"
              className="fill-sage-300"
            />
          ))}
        </svg>
      </button>

      <div className="flex flex-col gap-1 border-t border-ink-200 p-3 dark:border-ink-800">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const trimmed = draft.trim();
              if (trimmed && trimmed !== name) onRename(trimmed);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(name);
                setEditing(false);
              }
            }}
            aria-label={`Rename ${name}`}
            className="h-7 rounded-control border border-sage-500 bg-white px-1.5 text-body font-medium dark:bg-ink-800 dark:text-sage-50"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            onClick={onOpen}
            className="truncate text-left text-body font-medium text-ink-900 dark:text-sage-50"
          >
            {name}
          </button>
        )}
        <p className="text-caption text-ink-400">
          {formatLengthShort(width, displayUnit as 'm' | 'ft')} ×{' '}
          {formatLengthShort(length, displayUnit as 'm' | 'ft')} · {furnitureCount} items
        </p>
        <p className="text-[11px] text-ink-400">Edited {timeAgo(updatedAt)}</p>
      </div>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          size="sm"
          icon="copy"
          label={`Duplicate ${name}`}
          variant="secondary"
          onClick={onDuplicate}
        />
        <IconButton
          size="sm"
          icon="settings"
          label={`Rename ${name}`}
          variant="secondary"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        />
        <IconButton
          size="sm"
          icon="trash"
          label={`Delete ${name}`}
          variant="secondary"
          onClick={onDelete}
        />
      </div>
      <span className="sr-only" id={`project-${id}`} />
    </div>
  );
}

/** Room dimension guard rails, expressed in feet for the creation dialog. */
const MIN_W_L_FT = ROOM_LIMITS.minWidth / M_PER_FT;
const MAX_W_L_FT = ROOM_LIMITS.maxWidth / M_PER_FT;
const MIN_H_FT = ROOM_LIMITS.minHeight / M_PER_FT;
const MAX_H_FT = ROOM_LIMITS.maxHeight / M_PER_FT;

/**
 * New-room dialog: ask for the room size in feet up front, so the first thing
 * a user does is shape their space rather than accept a default.
 */
function NewRoomModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (widthFt: number, lengthFt: number, heightFt: number) => void;
}) {
  const [width, setWidth] = useState('12');
  const [length, setLength] = useState('14');
  const [height, setHeight] = useState('8');
  const [errors, setErrors] = useState<{
    width?: string;
    length?: string;
    height?: string;
  }>({});

  useEffect(() => {
    if (open) {
      setWidth('12');
      setLength('14');
      setHeight('8');
      setErrors({});
    }
  }, [open]);

  const validateField = (
    label: string,
    text: string,
    min: number,
    max: number
  ): string | undefined => {
    const value = Number(text);
    if (text.trim() === '' || !Number.isFinite(value)) return `${label} must be a number.`;
    if (value <= 0) return `${label} must be greater than zero.`;
    if (value < min) return `${label} must be at least ${Math.round(min * 10) / 10} ft.`;
    if (value > max) return `${label} cannot exceed ${Math.round(max)} ft.`;
    return undefined;
  };

  const handleCreate = () => {
    const nextErrors = {
      width: validateField('Width', width, MIN_W_L_FT, MAX_W_L_FT),
      length: validateField('Length', length, MIN_W_L_FT, MAX_W_L_FT),
      height: validateField('Height', height, MIN_H_FT, MAX_H_FT),
    };
    if (nextErrors.width || nextErrors.length || nextErrors.height) {
      setErrors(nextErrors);
      return;
    }
    onCreate(Number(width), Number(length), Number(height));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a new room"
      description="Set the room size in feet. You can change it later from the Room panel in the editor."
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={handleCreate}>
            Create room
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Width"
            type="number"
            inputMode="decimal"
            suffix="ft"
            value={width}
            error={errors.width}
            onChange={(e) => setWidth(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <TextField
            label="Length"
            type="number"
            inputMode="decimal"
            suffix="ft"
            value={length}
            error={errors.length}
            onChange={(e) => setLength(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
        </div>
        <TextField
          label="Ceiling height"
          type="number"
          inputMode="decimal"
          suffix="ft"
          value={height}
          error={errors.height}
          onChange={(e) => setHeight(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
        <p className="text-[11px] text-ink-400">
          Everything is set in feet; RoomCraft converts internally and displays
          dimensions back in feet.
        </p>
      </div>
    </Modal>
  );
}

export function Dashboard() {
  const projects = useProjects((s) => s.projects);
  const refresh = useProjects((s) => s.refresh);
  const save = useProjects((s) => s.save);
  const open = useProjects((s) => s.open);
  const remove = useProjects((s) => s.remove);
  const duplicate = useProjects((s) => s.duplicate);
  const renameProject = useProjects((s) => s.rename);

  const loadProject = useEditor((s) => s.loadProject);
  const applyTemplate = useEditor((s) => s.applyTemplateFurniture);
  const setRoomDimensions = useEditor((s) => s.setRoomDimensions);

  const setScreen = useUI((s) => s.setScreen);
  const toast = useUI((s) => s.toast);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recovery = useMemo(() => {
    const autosave = readAutosave();
    if (!autosave) return null;
    // Only offer it when it is genuinely newer than what was last saved.
    const known = projects.find((p) => p.id === autosave.project.id);
    if (known && known.updatedAt >= autosave.savedAt - 1500) return null;
    return autosave;
  }, [projects]);

  // Measured in an effect rather than during render: it walks every
  // localStorage key, and it only needs to change when the library does.
  const [usage, setUsage] = useState(0);
  useEffect(() => setUsage(estimateUsage()), [projects]);

  const openProject = (project: Project) => {
    loadProject(project);
    setScreen('editor');
  };

  const handleCreateCustomRoom = (widthFt: number, lengthFt: number, heightFt: number) => {
    const project = createRoomFromFeet({ widthFt, lengthFt, heightFt });
    save(project);
    openProject(project);
    setNewRoomOpen(false);
  };

  const startFromTemplate = (templateId: string) => {
    const template = ROOM_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const project = createProject(template.name === 'Empty room' ? 'Untitled room' : template.name);
    loadProject(project);
    setRoomDimensions({
      width: template.width,
      length: template.length,
      height: template.height,
    });
    if (template.furniture.length > 0) applyTemplate(template.furniture);

    const saved = useEditor.getState().toProject();
    const result = save(saved);
    if (!result.ok) {
      toast('Could not save the new project', {
        description: result.error,
        tone: 'error',
      });
    }
    setScreen('editor');
  };

  const importFile = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const result = parseProjectJSON(text);
      if (!result.ok) {
        toast('Import failed', { description: result.error, tone: 'error' });
        return;
      }
      const saveResult = save(result.project);
      if (!saveResult.ok) {
        toast('Imported, but could not save', {
          description: saveResult.error,
          tone: 'error',
        });
      }
      if (result.warnings.length > 0) {
        toast('Imported with changes', {
          description: result.warnings.slice(0, 2).join(' '),
          tone: 'warning',
        });
      } else {
        toast('Project imported', { tone: 'success' });
      }
      openProject(result.project);
    } catch (error) {
      toast('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error.',
        tone: 'error',
      });
    }
  };

  const deleteTarget = projects.find((p) => p.id === pendingDelete);

  return (
    <div className="scroll-thin h-full overflow-y-auto bg-ink-50 dark:bg-ink-950">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-title font-semibold text-ink-900 dark:text-sage-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-control bg-sage-800 text-sage-100">
                <Icon name="home" className="h-4 w-4" />
              </span>
              RoomCraft
            </h1>
            <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
              Plan a room to real dimensions, place furniture, and check it actually fits.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
            <Button icon="upload" onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setNewRoomOpen(true)}>
              New room
            </Button>
          </div>
        </header>

        {recovery && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-warn/40 bg-warn/10 px-4 py-3"
          >
            <div className="flex items-start gap-2.5">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
              <div>
                <p className="text-body font-medium text-ink-900 dark:text-sage-50">
                  Unsaved work recovered
                </p>
                <p className="text-caption text-ink-600 dark:text-ink-300">
                  “{recovery.project.name}” was autosaved {timeAgo(recovery.savedAt)} but
                  never saved to your library.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  clearAutosave();
                  refresh();
                  toast('Recovery discarded');
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  save(recovery.project);
                  clearAutosave();
                  openProject(recovery.project);
                }}
              >
                Restore
              </Button>
            </div>
          </motion.div>
        )}

        <section className="mb-10">
          <h2 className="mb-3 text-section font-semibold text-ink-900 dark:text-sage-50">
            Start from a template
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {ROOM_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => startFromTemplate(template.id)}
                className={clsx(
                  'flex flex-col items-start gap-1 rounded-panel border border-ink-200 bg-white p-3 text-left',
                  'transition-all duration-150 ease-out hover:border-sage-400 hover:shadow-subtle',
                  'dark:border-ink-800 dark:bg-ink-900'
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-control bg-sage-100 text-sage-700 dark:bg-sage-900/40 dark:text-sage-300">
                  <Icon name={template.id === 'blank' ? 'plus' : 'cube'} className="h-4 w-4" />
                </span>
                <span className="text-caption font-medium text-ink-800 dark:text-sage-50">
                  {template.name}
                </span>
                <span className="text-[11px] text-ink-400">
                  {formatArea(template.width * template.length, 'm')}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-section font-semibold text-ink-900 dark:text-sage-50">
              Your rooms
            </h2>
            {usage > 0 && (
              <Tooltip content="Approximate browser storage used by RoomCraft">
                <span className="text-[11px] text-ink-400">
                  {(usage / 1024).toFixed(0)} kB stored locally
                </span>
              </Tooltip>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="rounded-panel border border-dashed border-ink-300 bg-white dark:border-ink-700 dark:bg-ink-900">
              <EmptyState
                icon="cube"
                title="No rooms yet"
                description="Pick a template above, or start from an empty room and set your own dimensions."
                action={
                  <Button variant="primary" icon="plus" onClick={() => startFromTemplate('blank')}>
                    Create your first room
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  {...p}
                  onOpen={() => {
                    const project = open(p.id);
                    if (project) openProject(project);
                    else toast('Could not open that project', { tone: 'error' });
                  }}
                  onDuplicate={() => {
                    const copy = duplicate(p.id);
                    if (copy) toast(`Duplicated as “${copy.name}”`, { tone: 'success' });
                    else toast('Could not duplicate', { tone: 'error' });
                  }}
                  onRename={(name) => renameProject(p.id, name)}
                  onDelete={() => setPendingDelete(p.id)}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-ink-200 pt-5 text-caption text-ink-400 dark:border-ink-800">
          <p>
            Everything is stored in this browser only — nothing is uploaded. Use{' '}
            <strong className="font-medium">Export → Project file</strong> to back a room up
            or move it to another device.
          </p>
        </footer>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove(pendingDelete);
            toast('Project deleted');
          }
        }}
        title="Delete this project?"
        message={
          deleteTarget
            ? `“${deleteTarget.name}” and its ${deleteTarget.furnitureCount} placed items will be permanently removed from this browser. This cannot be undone.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete project"
      />

      <NewRoomModal
        open={newRoomOpen}
        onClose={() => setNewRoomOpen(false)}
        onCreate={handleCreateCustomRoom}
      />
    </div>
  );
}
