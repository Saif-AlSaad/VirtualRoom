import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { Opening, Project, Unit, WallPartition } from '@/types';
import { useProjects } from '@/store/projectsStore';
import { useEditor } from '@/store/editorStore';
import { useUI, resolveTheme } from '@/store/uiStore';
import { CATALOG, ROOM_TEMPLATES } from '@/data/catalog';
import { createProject, parseProjectJSON } from '@/utils/schema';
import {
  readAutosave,
  clearAutosave,
  estimateUsage,
  loadProject,
} from '@/utils/storage';
import { readFileAsText } from '@/utils/exporters';
import { formatArea, formatLengthShort, M_PER_FT } from '@/utils/units';
import { ROOM_LIMITS } from '@/utils/placement';
import { createRoomFromFeet } from '@/utils/roomCreation';
import { Icon } from './Icon';
import { Button, IconButton, TextField, Tooltip } from './primitives';
import { ConfirmDialog, Modal } from './Modal';

/** Fast catalog item size lookup for blueprint floorplan previews */
const CATALOG_SIZE_MAP: Record<string, { w: number; d: number }> = Object.fromEntries(
  CATALOG.map((item) => [item.id, { w: item.size.w, d: item.size.d }])
);

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

/**
 * Architectural Floorplan Blueprint Vector Thumbnail
 *
 * Renders an authentic CAD / blueprint style top-down 2D floorplan.
 * Accurately scales room proportions, wall thickness, doors with swing arcs,
 * windows, partition walls, and placed furniture pieces.
 */
function FloorplanBlueprint({
  width,
  length,
  furniture = [],
  openings = [],
  partitions = [],
  furnitureCount = 0,
  unit = 'm',
}: {
  width: number;
  length: number;
  furniture?: Array<{
    x: number;
    z: number;
    w?: number;
    d?: number;
    rotation?: number;
    catalogId?: string;
  }>;
  openings?: Opening[];
  partitions?: WallPartition[];
  furnitureCount?: number;
  unit?: string;
}) {
  const vbW = 160;
  const vbH = 100;
  const cx = vbW / 2;
  const cy = vbH / 2;

  // Compute room footprint preserving aspect ratio within bounding box
  const maxRoomW = 120;
  const maxRoomH = 72;
  const aspect = width / length;
  let rw: number;
  let rh: number;

  if (aspect >= maxRoomW / maxRoomH) {
    rw = maxRoomW;
    rh = Math.max(26, maxRoomW / aspect);
  } else {
    rh = maxRoomH;
    rw = Math.max(26, maxRoomH * aspect);
  }

  const scale = rw / width; // pixels per metre
  const rx = cx - rw / 2;
  const ry = cy - rh / 2;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="h-full w-full select-none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Subtle architectural floor grid */}
        <pattern id={`bp-grid-${rw}-${rh}`} width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke="var(--blueprint-grid)"
            strokeWidth="0.6"
            strokeDasharray="1 2"
          />
        </pattern>
      </defs>

      {/* Outer ambient canvas */}
      <rect x="0" y="0" width={vbW} height={vbH} fill="var(--blueprint-canvas)" />

      {/* Room interior surface */}
      <rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        fill="var(--blueprint-interior)"
        rx="2"
      />
      <rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        fill={`url(#bp-grid-${rw}-${rh})`}
        rx="2"
        opacity="0.8"
      />

      {/* Exterior wall thickness */}
      <rect
        x={rx - 1.5}
        y={ry - 1.5}
        width={rw + 3}
        height={rh + 3}
        fill="none"
        stroke="var(--studio-border)"
        strokeWidth="3.2"
        rx="3"
      />
      <rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        fill="none"
        stroke="var(--studio-accent)"
        strokeWidth="1.2"
        rx="2"
        opacity="0.85"
      />

      {/* Architectural corner crosshair ticks */}
      <g stroke="var(--studio-accent)" strokeWidth="0.75" opacity="0.5">
        <line x1={rx - 4} y1={ry} x2={rx + 4} y2={ry} />
        <line x1={rx} y1={ry - 4} x2={rx} y2={ry + 4} />
        <line x1={rx + rw - 4} y1={ry} x2={rx + rw + 4} y2={ry} />
        <line x1={rx + rw} y1={ry - 4} x2={rx + rw} y2={ry + 4} />
        <line x1={rx - 4} y1={ry + rh} x2={rx + 4} y2={ry + rh} />
        <line x1={rx} y1={ry + rh - 4} x2={rx} y2={ry + rh + 4} />
        <line x1={rx + rw - 4} y1={ry + rh} x2={rx + rw + 4} y2={ry + rh} />
        <line x1={rx + rw} y1={ry + rh - 4} x2={rx + rw} y2={ry + rh + 4} />
      </g>

      {/* Partition walls */}
      {partitions.map((p) => {
        const px = cx + p.position.x * scale;
        const py = cy + p.position.z * scale;
        const pLen = Math.max(3, p.length * scale);
        const pThick = Math.max(1.8, p.thickness * scale);
        const rot = p.rotation ?? 0;
        return (
          <rect
            key={p.id}
            x={px - pLen / 2}
            y={py - pThick / 2}
            width={pLen}
            height={pThick}
            transform={`rotate(${rot} ${px} ${py})`}
            rx="1"
            fill="var(--studio-border)"
            stroke="var(--studio-accent)"
            strokeWidth="0.9"
            opacity="0.9"
          />
        );
      })}

      {/* Openings (Doors with swing arc & Windows) */}
      {openings.map((op, i) => {
        const opW = Math.max(4, op.width * scale);
        let ox = rx;
        let oy = ry;

        if (op.wall === 'north') {
          ox = rx + op.offset * scale;
          oy = ry;
        } else if (op.wall === 'south') {
          ox = rx + op.offset * scale;
          oy = ry + rh;
        } else if (op.wall === 'west') {
          ox = rx;
          oy = ry + op.offset * scale;
        } else if (op.wall === 'east') {
          ox = rx + rw;
          oy = ry + op.offset * scale;
        }

        if (op.kind === 'window') {
          const isHoriz = op.wall === 'north' || op.wall === 'south';
          return (
            <g key={`op-${i}`} stroke="var(--studio-accent)" strokeWidth="1.2">
              <line
                x1={isHoriz ? ox - opW / 2 : ox - 1.5}
                y1={isHoriz ? oy - 1.5 : oy - opW / 2}
                x2={isHoriz ? ox + opW / 2 : ox - 1.5}
                y2={isHoriz ? oy - 1.5 : oy + opW / 2}
              />
              <line
                x1={isHoriz ? ox - opW / 2 : ox + 1.5}
                y1={isHoriz ? oy + 1.5 : oy - opW / 2}
                x2={isHoriz ? ox + opW / 2 : ox + 1.5}
                y2={isHoriz ? oy + 1.5 : oy + opW / 2}
              />
            </g>
          );
        }

        // Door leaf with subtle swing quadrant
        return (
          <g key={`op-${i}`} opacity="0.8">
            <line
              x1={ox}
              y1={oy}
              x2={ox + (op.wall === 'west' ? opW : op.wall === 'east' ? -opW : 0)}
              y2={oy + (op.wall === 'north' ? opW : op.wall === 'south' ? -opW : 0)}
              stroke="var(--studio-text-muted)"
              strokeWidth="1.2"
            />
          </g>
        );
      })}

      {/* Furniture Pieces */}
      {furniture.length > 0 ? (
        furniture.map((item, i) => {
          const ix = cx + item.x * scale;
          const iy = cy + item.z * scale;
          const catSize = item.catalogId ? CATALOG_SIZE_MAP[item.catalogId] : undefined;
          const fw = Math.max(3.5, (item.w ?? catSize?.w ?? 0.8) * scale);
          const fd = Math.max(3.5, (item.d ?? catSize?.d ?? 0.8) * scale);
          const rot = item.rotation ?? 0;
          const isRug = item.catalogId?.includes('rug');

          if (isRug) {
            return (
              <rect
                key={`furn-${i}`}
                x={ix - fw / 2}
                y={iy - fd / 2}
                width={fw}
                height={fd}
                transform={`rotate(${rot} ${ix} ${iy})`}
                rx="1.5"
                fill="rgba(var(--studio-accent-rgb), 0.08)"
                stroke="var(--studio-accent)"
                strokeWidth="0.7"
                strokeDasharray="2 1.5"
                opacity="0.85"
              />
            );
          }

          return (
            <g key={`furn-${i}`} transform={`rotate(${rot} ${ix} ${iy})`}>
              <rect
                x={ix - fw / 2}
                y={iy - fd / 2}
                width={fw}
                height={fd}
                rx="1.5"
                fill="var(--studio-elevated)"
                stroke="var(--studio-accent)"
                strokeWidth="0.85"
                opacity="0.95"
              />
              {/* Inner detail line for larger furniture like beds and sofas */}
              {fw > 10 && fd > 10 && (
                <line
                  x1={ix - fw / 2 + 2}
                  y1={iy - fd / 2 + 3}
                  x2={ix + fw / 2 - 2}
                  y2={iy - fd / 2 + 3}
                  stroke="var(--studio-accent)"
                  strokeWidth="0.5"
                  opacity="0.6"
                />
              )}
            </g>
          );
        })
      ) : furnitureCount > 0 ? (
        // Proportional placement grid when full furniture array isn't hydrated
        Array.from({ length: Math.min(furnitureCount, 6) }, (_, i) => {
          const cols = Math.min(3, Math.ceil(Math.sqrt(furnitureCount)));
          const col = i % cols;
          const row = Math.floor(i / cols);
          const itemW = Math.max(5, rw / 4.5);
          const itemH = Math.max(5, rh / 4.5);
          const px = rx + 8 + col * (itemW + 6);
          const py = ry + 8 + row * (itemH + 6);
          return (
            <rect
              key={`ph-${i}`}
              x={px}
              y={py}
              width={itemW}
              height={itemH}
              rx="1.5"
              fill="var(--studio-elevated)"
              stroke="var(--studio-accent)"
              strokeWidth="0.8"
              opacity="0.85"
            />
          );
        })
      ) : (
        // Clean empty room architectural indicator
        <g opacity="0.4" stroke="var(--studio-accent)" strokeWidth="0.75">
          <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} />
          <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} />
          <circle cx={cx} cy={cy} r="2.5" fill="none" strokeDasharray="1 1" />
        </g>
      )}

      {/* Dimension Label pill on floor */}
      <text
        x={cx}
        y={ry + rh - 4}
        textAnchor="middle"
        fill="var(--studio-text-dim)"
        className="text-[7.5px] font-mono tracking-wider"
        opacity="0.75"
      >
        {formatLengthShort(width, unit as Unit)} × {formatLengthShort(length, unit as Unit)}
      </text>
    </svg>
  );
}

/**
 * Project Card — Upgrade for "Your rooms" section
 */
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

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Load project document synchronously from localStorage for authentic vector blueprint
  const fullProject = useMemo(() => {
    try {
      return loadProject(id);
    } catch {
      return null;
    }
  }, [id, updatedAt]);

  const furniture = useMemo(() => {
    if (!fullProject) return undefined;
    return fullProject.furniture.map((f) => ({
      x: f.position.x,
      z: f.position.z,
      rotation: f.rotation,
      catalogId: f.catalogId,
      w: f.scale ? f.scale.x * (CATALOG_SIZE_MAP[f.catalogId]?.w ?? 0.8) : undefined,
      d: f.scale ? f.scale.z * (CATALOG_SIZE_MAP[f.catalogId]?.d ?? 0.8) : undefined,
    }));
  }, [fullProject]);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[14px] border border-studio-border bg-studio-card transition-all duration-200 hover:-translate-y-0.5 hover:border-studio-accent/70 hover:shadow-medium">
      {/* Upper Area: Room Preview */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open project ${name}`}
        className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-studio-sidebar transition-colors group-hover:brightness-105"
      >
        <FloorplanBlueprint
          width={width}
          length={length}
          furniture={furniture}
          openings={fullProject?.room.openings}
          partitions={fullProject?.room.partitions}
          furnitureCount={furnitureCount}
          unit={unit}
        />

        {/* Top-left specs badge */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-studio-card/85 px-2 py-0.5 text-[10px] font-medium text-studio-text-muted backdrop-blur-sm border border-studio-border/70">
          <span className="h-1.5 w-1.5 rounded-full bg-studio-accent" />
          <span>{furnitureCount} {furnitureCount === 1 ? 'item' : 'items'}</span>
        </div>

        {/* Bottom-left floor area badge */}
        <div className="absolute bottom-2.5 left-2.5 rounded bg-studio-card/90 px-1.5 py-0.5 text-[10px] font-mono text-studio-accent backdrop-blur-sm border border-studio-border/60">
          {formatArea(width * length, unit as Unit)}
        </div>
      </button>

      {/* Lower Area: Room Metadata & Information */}
      <div className="flex flex-col gap-1.5 border-t border-studio-divider p-3.5">
        <div className="flex items-center justify-between gap-2">
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
              className="h-7 w-full rounded-control border border-studio-accent bg-studio-elevated px-2 text-sm font-medium text-studio-text outline-none focus:ring-1 focus:ring-studio-accent"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => {
                setDraft(name);
                setEditing(true);
              }}
              onClick={onOpen}
              className="truncate text-left text-sm font-medium text-studio-text transition-colors group-hover:text-studio-accent"
              title="Click to open, double-click to rename"
            >
              {name}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-caption text-studio-text-dim">
          <span className="font-mono">
            {formatLengthShort(width, unit as Unit)} × {formatLengthShort(length, unit as Unit)}
          </span>
          <span className="text-[11px]">Edited {timeAgo(updatedAt)}</span>
        </div>
      </div>

      {/* Floating Actions on Hover / Focus */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-control bg-studio-card/90 p-1 opacity-0 shadow-subtle backdrop-blur-md transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 border border-studio-border">
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

/** Room dimension guard rails, expressed in feet for the creation dialog */
const MIN_W_L_FT = ROOM_LIMITS.minWidth / M_PER_FT;
const MAX_W_L_FT = ROOM_LIMITS.maxWidth / M_PER_FT;
const MIN_H_FT = ROOM_LIMITS.minHeight / M_PER_FT;
const MAX_H_FT = ROOM_LIMITS.maxHeight / M_PER_FT;

/**
 * New-room dialog: ask for the room size in feet up front
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
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center justify-center rounded-[8px] border border-studio-border bg-studio-card px-4 text-xs font-medium text-studio-text transition-all hover:bg-studio-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="flex h-9 items-center gap-1.5 justify-center rounded-[8px] bg-studio-accent px-4 text-xs font-semibold text-studio-bg shadow-subtle transition-all hover:bg-studio-accent-hover active:scale-[0.98]"
          >
            <Icon name="plus" className="h-3.5 w-3.5 stroke-[2.2]" />
            <span>Create room</span>
          </button>
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
        <p className="text-[11px] text-studio-text-dim">
          Everything is set in feet; RoomCraft converts internally and displays dimensions back in feet.
        </p>
      </div>
    </Modal>
  );
}

/**
 * Studio Settings & Preferences Modal
 */
function StudioSettingsModal({
  open,
  onClose,
  usage,
}: {
  open: boolean;
  onClose: () => void;
  usage: number;
}) {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const openModal = useUI((s) => s.openModal);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Studio Settings"
      description="Preferences and storage settings for your RoomCraft workspace."
      size="sm"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 items-center justify-center rounded-[8px] bg-studio-accent px-5 text-xs font-semibold text-studio-bg shadow-subtle transition-all hover:bg-studio-accent-hover active:scale-[0.98]"
        >
          Done
        </button>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-studio-text">
        {/* Appearance Theme — Smooth Segmented Control */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-studio-text-muted">Appearance theme</span>
            <span className="text-[11px] text-studio-text-dim">Applied across workspace</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-[10px] border border-studio-border bg-studio-card p-1">
            {(['dark', 'light', 'system'] as const).map((t) => {
              const active = theme === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={clsx(
                    'flex items-center justify-center gap-2 rounded-[8px] py-2 text-xs font-semibold capitalize transition-all duration-150',
                    active
                      ? 'bg-studio-accent text-studio-bg shadow-sm'
                      : 'text-studio-text-muted hover:bg-studio-hover hover:text-studio-text'
                  )}
                >
                  <Icon
                    name={t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'sparkle'}
                    className={clsx('h-3.5 w-3.5', active ? 'text-studio-bg' : 'text-studio-text-dim')}
                  />
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Keyboard Shortcuts Card */}
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-studio-border bg-studio-card p-3.5 transition-colors hover:border-studio-accent/30">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-studio-border bg-studio-elevated text-studio-accent">
              <Icon name="keyboard" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-studio-text">Keyboard shortcuts</p>
              <p className="text-[11px] text-studio-text-muted">Camera orbit, panning, snapping, and hotkeys</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              openModal('shortcuts');
            }}
            className="flex items-center gap-1.5 rounded-[8px] border border-studio-border bg-studio-elevated px-3 py-1.5 text-xs font-medium text-studio-text transition-all hover:border-studio-accent/40 hover:bg-studio-hover"
          >
            <span>View</span>
            <Icon name="chevron-right" className="h-3 w-3 text-studio-text-dim" />
          </button>
        </div>

        {/* Storage Health Card */}
        <div className="flex flex-col gap-2 rounded-[12px] border border-studio-border bg-studio-card p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-studio-border bg-studio-elevated text-studio-accent">
                <Icon name="cloud-off" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-studio-text">Private browser storage</p>
                <p className="text-[11px] text-studio-text-dim">Device-local · Zero cloud dependencies</p>
              </div>
            </div>
            <span className="rounded-full border border-studio-accent/30 bg-studio-accent-muted/40 px-2.5 py-0.5 font-mono text-[11px] font-medium text-studio-accent">
              {(usage / 1024).toFixed(0)} kB used
            </span>
          </div>
          <p className="border-t border-studio-divider/60 pt-2 text-[11px] leading-relaxed text-studio-text-dim">
            All rooms and placed items are safely stored in your browser's private local storage. Nothing is uploaded to external servers.
          </p>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Refined Vertical Navigation Sidebar (Desktop 240px + Mobile Drawer)
 */
function AppSidebar({
  activeNav,
  onNavigate,
  onImport,
  onOpenSettings,
  usage,
  mobileOpen,
  onCloseMobile,
}: {
  activeNav: 'home' | 'templates' | 'rooms';
  onNavigate: (section: 'home' | 'templates' | 'rooms') => void;
  onImport: () => void;
  onOpenSettings: () => void;
  usage: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const content = (
    <div className="flex h-full w-full flex-col justify-between bg-studio-sidebar p-4 select-none">
      {/* Brand & Wordmark */}
      <div>
        <div className="flex items-center gap-2.5 px-2 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-studio-accent-muted border border-studio-accent/40 text-studio-accent shadow-subtle">
            <Icon name="home" className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-semibold tracking-tight text-studio-text">RoomCraft</h1>
              <span className="rounded bg-studio-accent-muted px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-studio-accent">
                Studio
              </span>
            </div>
            <p className="text-[11px] text-studio-text-dim">Spatial Interior Suite</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main navigation">
          <button
            type="button"
            onClick={() => {
              onNavigate('home');
              onCloseMobile();
            }}
            className={clsx(
              'flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors text-left',
              activeNav === 'home'
                ? 'bg-studio-accent-muted/60 text-studio-text border-l-2 border-studio-accent'
                : 'text-studio-text-muted hover:bg-studio-hover hover:text-studio-text'
            )}
          >
            <Icon name="home" className={clsx('h-4 w-4', activeNav === 'home' ? 'text-studio-accent' : '')} />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate('templates');
              onCloseMobile();
            }}
            className={clsx(
              'flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors text-left',
              activeNav === 'templates'
                ? 'bg-studio-accent-muted/60 text-studio-text border-l-2 border-studio-accent'
                : 'text-studio-text-muted hover:bg-studio-hover hover:text-studio-text'
            )}
          >
            <Icon name="grid" className={clsx('h-4 w-4', activeNav === 'templates' ? 'text-studio-accent' : '')} />
            <span>Templates</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate('rooms');
              onCloseMobile();
            }}
            className={clsx(
              'flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors text-left',
              activeNav === 'rooms'
                ? 'bg-studio-accent-muted/60 text-studio-text border-l-2 border-studio-accent'
                : 'text-studio-text-muted hover:bg-studio-hover hover:text-studio-text'
            )}
          >
            <Icon name="cube" className={clsx('h-4 w-4', activeNav === 'rooms' ? 'text-studio-accent' : '')} />
            <span>My Rooms</span>
          </button>

          <div className="my-2 border-t border-studio-divider" />

          <button
            type="button"
            onClick={() => {
              onImport();
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium text-studio-text-muted transition-colors hover:bg-studio-hover hover:text-studio-text text-left"
          >
            <Icon name="upload" className="h-4 w-4" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium text-studio-text-muted transition-colors hover:bg-studio-hover hover:text-studio-text text-left"
          >
            <Icon name="settings" className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Sidebar Footer: Storage Info & Tagline */}
      <div className="flex flex-col gap-2.5 border-t border-studio-divider pt-4">
        {usage > 0 && (
          <Tooltip content="Everything is stored in this browser only. Zero cloud tracking.">
            <div className="flex items-center gap-2 rounded-control bg-studio-card px-2.5 py-1.5 text-[11px] text-studio-text-dim border border-studio-border">
              <Icon name="cloud-off" className="h-3.5 w-3.5 shrink-0 text-studio-accent" />
              <span className="font-mono">{(usage / 1024).toFixed(0)} kB local storage</span>
            </div>
          </Tooltip>
        )}
        <p className="px-1 text-[11px] text-studio-text-dim">
          Precision Interior Planning
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (240px) */}
      <aside className="hidden h-full w-60 shrink-0 border-r border-studio-border bg-studio-sidebar md:flex md:flex-col">
        {content}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 h-full w-64 border-r border-studio-border bg-studio-sidebar shadow-high"
            >
              {content}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Top Application Bar
 */
function TopBar({
  onOpenNewRoom,
  onImport,
  onToggleMobileNav,
}: {
  onOpenNewRoom: () => void;
  onImport: () => void;
  onToggleMobileNav: () => void;
}) {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const isDark = resolveTheme(theme) === 'dark';

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-studio-border bg-studio-bg/90 px-6 backdrop-blur-md md:px-8">
      {/* Left: Mobile Nav Toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileNav}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-control border border-studio-border bg-studio-card text-studio-text hover:bg-studio-hover md:hidden"
        >
          <Icon name="more" className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-studio-text-dim">Workspace</span>
          <span className="text-studio-border">/</span>
          <span className="font-semibold text-studio-text">Studio Overview</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        <IconButton
          size="sm"
          icon={isDark ? 'sun' : 'moon'}
          label={isDark ? 'Switch to light interface' : 'Switch to dark interface'}
          variant="secondary"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        />

        {/* Secondary Button — Import */}
        <button
          type="button"
          onClick={onImport}
          className="flex h-10 items-center gap-2 rounded-[9px] border border-studio-border bg-studio-card px-3.5 text-xs font-medium text-studio-text transition-all hover:bg-studio-hover hover:border-studio-accent/40"
        >
          <Icon name="upload" className="h-4 w-4 text-studio-text-muted" />
          <span>Import</span>
        </button>

        {/* Primary Button — + New Room */}
        <button
          type="button"
          onClick={onOpenNewRoom}
          className="flex h-10 items-center gap-2 rounded-[9px] bg-studio-accent px-4 text-xs font-semibold text-studio-bg shadow-subtle transition-all hover:bg-studio-accent-hover active:scale-[0.98]"
        >
          <Icon name="plus" className="h-4 w-4 stroke-[2.2]" />
          <span>+ New room</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Welcome Hero Section
 */
function WelcomeHero({
  onOpenNewRoom,
  onExploreTemplates,
}: {
  onOpenNewRoom: () => void;
  onExploreTemplates: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-studio-border bg-gradient-to-r from-studio-card via-studio-elevated to-studio-card p-6 md:p-8 shadow-medium">
      {/* Decorative architectural grid background overlay */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-10"
        aria-hidden="true"
      >
        <defs>
          <pattern id="hero-architectural-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--studio-accent)" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="1.5" fill="var(--studio-accent)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-architectural-grid)" />
      </svg>

      {/* Soft ambient sage glow in corner */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(var(--studio-accent-rgb), 0.14) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-start gap-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-studio-accent" />
          <span className="font-mono text-[11px] font-semibold tracking-widest uppercase text-studio-accent">
            PLAN · DESIGN · MAKE IT YOURS
          </span>
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-studio-text">
            Create your perfect space.
          </h2>
          <p className="mt-1.5 text-sm md:text-body leading-relaxed text-studio-text-muted">
            Plan rooms, experiment with layouts, place furniture, and bring your ideas to life.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onOpenNewRoom}
            className="flex h-10 items-center gap-2 rounded-[9px] bg-studio-accent px-4 text-xs font-semibold text-studio-bg shadow-subtle transition-all hover:bg-studio-accent-hover active:scale-[0.98]"
          >
            <Icon name="plus" className="h-4 w-4 stroke-[2.2]" />
            <span>+ New Room</span>
          </button>

          <button
            type="button"
            onClick={onExploreTemplates}
            className="flex h-10 items-center gap-2 rounded-[9px] border border-studio-border bg-studio-card/80 px-4 text-xs font-medium text-studio-text transition-all hover:bg-studio-hover hover:border-studio-accent/40"
          >
            <Icon name="grid" className="h-4 w-4 text-studio-text-muted" />
            <span>Explore Templates</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Project Dashboard
 */
export function Dashboard() {
  const projects = useProjects((s) => s.projects);
  const refresh = useProjects((s) => s.refresh);
  const save = useProjects((s) => s.save);
  const open = useProjects((s) => s.open);
  const remove = useProjects((s) => s.remove);
  const duplicate = useProjects((s) => s.duplicate);
  const renameProject = useProjects((s) => s.rename);

  const loadProjectDoc = useEditor((s) => s.loadProject);
  const applyTemplate = useEditor((s) => s.applyTemplateFurniture);
  const setRoomDimensions = useEditor((s) => s.setRoomDimensions);

  const setScreen = useUI((s) => s.setScreen);
  const toast = useUI((s) => s.toast);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState<'home' | 'templates' | 'rooms'>('home');

  const fileRef = useRef<HTMLInputElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recovery = useMemo(() => {
    const autosave = readAutosave();
    if (!autosave) return null;
    const known = projects.find((p) => p.id === autosave.project.id);
    if (known && known.updatedAt >= autosave.savedAt - 1500) return null;
    return autosave;
  }, [projects]);

  const [usage, setUsage] = useState(0);
  useEffect(() => setUsage(estimateUsage()), [projects]);

  const openProject = (project: Project) => {
    loadProjectDoc(project);
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
    loadProjectDoc(project);
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

  const handleNavigate = (section: 'home' | 'templates' | 'rooms') => {
    setActiveNav(section);
    if (section === 'home') {
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'templates') {
      document.getElementById('templates-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'rooms') {
      document.getElementById('rooms-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const deleteTarget = projects.find((p) => p.id === pendingDelete);

  return (
    <div className="flex h-full w-full overflow-hidden bg-studio-bg text-studio-text antialiased">
      {/* ── Left Sidebar (240px) ─────────────────────────────────── */}
      <AppSidebar
        activeNav={activeNav}
        onNavigate={handleNavigate}
        onImport={() => fileRef.current?.click()}
        onOpenSettings={() => setSettingsOpen(true)}
        usage={usage}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* ── Main Content Area ────────────────────────────────────── */}
      <div ref={mainScrollRef} className="scroll-thin flex-1 overflow-y-auto">
        {/* Top Application Bar */}
        <TopBar
          onOpenNewRoom={() => setNewRoomOpen(true)}
          onImport={() => fileRef.current?.click()}
          onToggleMobileNav={() => setMobileNavOpen(true)}
        />

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

        <main className="mx-auto flex w-full max-w-7xl flex-col gap-9 px-6 py-8 md:px-10">
          {/* Unsaved Work Recovery Banner */}
          {recovery && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warn/40 bg-warn/10 px-4 py-3"
            >
              <div className="flex items-start gap-2.5">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <div>
                  <p className="text-sm font-semibold text-studio-text">
                    Unsaved work recovered
                  </p>
                  <p className="text-caption text-studio-text-muted">
                    “{recovery.project.name}” was autosaved {timeAgo(recovery.savedAt)} but never saved to your library.
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

          {/* Welcome Hero Section */}
          <WelcomeHero
            onOpenNewRoom={() => setNewRoomOpen(true)}
            onExploreTemplates={() => handleNavigate('templates')}
          />

          {/* ── Room Templates Section ───────────────────────────── */}
          <section id="templates-section" className="flex flex-col gap-3.5 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base md:text-lg font-semibold tracking-tight text-studio-text">
                  Start with a template
                </h3>
                <p className="text-caption text-studio-text-muted">
                  Choose a layout to get started
                </p>
              </div>
              <span className="rounded-full border border-studio-border bg-studio-card px-2.5 py-0.5 text-[11px] font-medium text-studio-text-dim">
                6 layouts
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {ROOM_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => startFromTemplate(template.id)}
                  className={clsx(
                    'group flex flex-col overflow-hidden rounded-[12px] border border-studio-border bg-studio-card text-left transition-all duration-200',
                    'hover:-translate-y-0.5 hover:border-studio-accent/70 hover:shadow-subtle'
                  )}
                >
                  {/* Top: Architectural Blueprint Vector Preview */}
                  <div className="aspect-[4/3] w-full overflow-hidden bg-studio-sidebar border-b border-studio-divider">
                    <FloorplanBlueprint
                      width={template.width}
                      length={template.length}
                      furniture={template.furniture.map((f) => ({
                        x: f.x,
                        z: f.z,
                        rotation: f.rotation,
                        catalogId: f.catalogId,
                      }))}
                    />
                  </div>

                  {/* Bottom: Template metadata */}
                  <div className="flex flex-col gap-1 p-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold text-studio-text group-hover:text-studio-accent transition-colors">
                        {template.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-studio-text-dim">
                      {formatArea(template.width * template.length, 'm')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Saved Rooms / Projects Section ───────────────────── */}
          <section id="rooms-section" className="flex flex-col gap-3.5 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base md:text-lg font-semibold tracking-tight text-studio-text">
                  Your rooms
                </h3>
                <p className="text-caption text-studio-text-muted">
                  Continue where you left off
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Search / filter projects if user has saved projects */}
                {projects.length > 2 && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search rooms..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-44 md:w-56 rounded-control border border-studio-border bg-studio-card pl-7 pr-3 text-xs text-studio-text placeholder-studio-text-dim outline-none transition-all focus:border-studio-accent focus:ring-1 focus:ring-studio-accent"
                    />
                    <Icon name="search" className="absolute left-2 top-2 h-3.5 w-3.5 text-studio-text-dim" />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-2 text-studio-text-dim hover:text-studio-text"
                      >
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {usage > 0 && (
                  <Tooltip content="Approximate browser storage used by RoomCraft">
                    <span className="hidden sm:inline-block rounded-full border border-studio-border bg-studio-card px-2.5 py-1 text-[11px] font-mono text-studio-text-dim">
                      {(usage / 1024).toFixed(0)} kB stored locally
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-studio-border bg-studio-card/50 p-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-studio-elevated border border-studio-border text-studio-accent">
                  <Icon name="cube" className="h-6 w-6" />
                </span>
                <h4 className="mt-4 text-base font-semibold text-studio-text">No rooms yet</h4>
                <p className="mt-1 max-w-sm text-caption text-studio-text-muted">
                  Pick a template above, or start from an empty room and shape your space to your custom dimensions.
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => startFromTemplate('blank')}
                    className="flex h-9 items-center gap-2 rounded-[8px] bg-studio-accent px-4 text-xs font-semibold text-studio-bg shadow-subtle transition-all hover:bg-studio-accent-hover"
                  >
                    <Icon name="plus" className="h-3.5 w-3.5 stroke-[2.2]" />
                    <span>Create your first room</span>
                  </button>
                </div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-[14px] border border-studio-border bg-studio-card p-8 text-center">
                <p className="text-sm text-studio-text">No rooms match “{searchQuery}”</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs font-medium text-studio-accent hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProjects.map((p) => (
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

          {/* Footer Notice */}
          <footer className="mt-4 border-t border-studio-divider pt-6 text-caption text-studio-text-dim">
            <p>
              Everything is stored in this browser only — nothing is uploaded. Use{' '}
              <strong className="font-medium text-studio-text-muted">Export → Project file</strong> to back a room up or move it to another device.
            </p>
          </footer>
        </main>
      </div>

      {/* Confirmation Dialog on Delete */}
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

      {/* Custom Room Creation Modal */}
      <NewRoomModal
        open={newRoomOpen}
        onClose={() => setNewRoomOpen(false)}
        onCreate={handleCreateCustomRoom}
      />

      {/* Studio Settings Modal */}
      <StudioSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        usage={usage}
      />
    </div>
  );
}
