import { useMemo } from 'react';
import clsx from 'clsx';
import type { WallSide } from '@/types';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { FLOOR_PRESETS, WALL_COLORS, WALL_PATTERNS } from '@/data/finishes';
import { ROOM_LIMITS, occupiedFloorArea, totalCost } from '@/utils/placement';
import { WALL_LABEL, WALL_SIDES, floorArea, wallLength } from '@/utils/roomGeometry';
import { formatArea, formatLength, fromDisplay, parseLength, toDisplay, unitLabel } from '@/utils/units';
import { formatCurrency } from '@/utils/exporters';
import { Icon } from './Icon';
import { Button, IconButton, NumberField, Section, Segmented, SwatchGrid, Switch } from './primitives';

/**
 * Room inspector: dimensions, finishes, openings and a live summary.
 *
 * Dimension edits go through the store's `setRoomDimensions`, which reflows
 * openings and furniture back inside the new box. That is the difference
 * between "resizing the room" and "silently corrupting the layout" — shrinking
 * a room must never leave a wardrobe embedded in a wall.
 */

function OpeningRow({ id }: { id: string }) {
  const doc = useEditor((s) => s.doc);
  const updateOpening = useEditor((s) => s.updateOpening);
  const removeOpening = useEditor((s) => s.removeOpening);
  const unit = doc.unit;

  const opening = doc.room.openings.find((o) => o.id === id);
  if (!opening) return null;

  const dims = doc.room.dimensions;
  const maxOffset = wallLength(opening.wall, dims);

  return (
    <div className="flex flex-col gap-2.5 rounded-panel border border-ink-200 p-3 dark:border-ink-800">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-caption font-medium text-ink-700 dark:text-ink-200">
          <Icon name={opening.kind === 'door' ? 'door' : 'window'} className="h-4 w-4 text-ink-400" />
          {opening.kind === 'door' ? 'Door' : 'Window'}
        </span>
        <IconButton
          size="sm"
          icon="trash"
          label={`Delete ${opening.kind}`}
          onClick={() => removeOpening(opening.id)}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink-500 dark:text-ink-400">Wall</span>
        <select
          value={opening.wall}
          onChange={(e) => updateOpening(opening.id, { wall: e.target.value as WallSide })}
          className="h-8 rounded-control border border-ink-200 bg-white px-2 text-caption dark:border-ink-700 dark:bg-ink-800 dark:text-sage-50"
        >
          {WALL_SIDES.map((side) => (
            <option key={side} value={side}>
              {WALL_LABEL[side]}
            </option>
          ))}
        </select>
      </label>

      <NumberField
        label="Position along wall"
        suffix={unitLabel(unit)}
        value={toDisplay(opening.offset, unit)}
        min={0}
        max={toDisplay(maxOffset, unit)}
        step={0.01}
        format={(v) => v.toFixed(2)}
        parse={(t) => {
          const m = parseLength(t, unit);
          return m === null ? null : toDisplay(m, unit);
        }}
        onChange={(v) => updateOpening(opening.id, { offset: fromDisplay(v, unit) }, true)}
        onCommit={(v) => updateOpening(opening.id, { offset: fromDisplay(v, unit) })}
      />
      <NumberField
        label="Width"
        suffix={unitLabel(unit)}
        value={toDisplay(opening.width, unit)}
        min={toDisplay(0.2, unit)}
        max={toDisplay(maxOffset, unit)}
        step={0.01}
        format={(v) => v.toFixed(2)}
        parse={(t) => {
          const m = parseLength(t, unit);
          return m === null ? null : toDisplay(m, unit);
        }}
        onChange={(v) => updateOpening(opening.id, { width: fromDisplay(v, unit) }, true)}
        onCommit={(v) => updateOpening(opening.id, { width: fromDisplay(v, unit) })}
      />
      <NumberField
        label="Height"
        suffix={unitLabel(unit)}
        value={toDisplay(opening.height, unit)}
        min={toDisplay(0.2, unit)}
        max={toDisplay(dims.height, unit)}
        step={0.01}
        format={(v) => v.toFixed(2)}
        parse={(t) => {
          const m = parseLength(t, unit);
          return m === null ? null : toDisplay(m, unit);
        }}
        onChange={(v) => updateOpening(opening.id, { height: fromDisplay(v, unit) }, true)}
        onCommit={(v) => updateOpening(opening.id, { height: fromDisplay(v, unit) })}
      />

      {opening.kind === 'window' ? (
        <NumberField
          label="Sill height"
          suffix={unitLabel(unit)}
          value={toDisplay(opening.sillHeight, unit)}
          min={0}
          max={toDisplay(Math.max(0, dims.height - opening.height), unit)}
          step={0.01}
          format={(v) => v.toFixed(2)}
          parse={(t) => {
            const m = parseLength(t, unit);
            return m === null ? null : toDisplay(m, unit);
          }}
          onChange={(v) => updateOpening(opening.id, { sillHeight: fromDisplay(v, unit) }, true)}
          onCommit={(v) => updateOpening(opening.id, { sillHeight: fromDisplay(v, unit) })}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-ink-500 dark:text-ink-400">Hinge</span>
            <Segmented
              size="sm"
              label="Hinge side"
              value={opening.hinge}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(hinge) => updateOpening(opening.id, { hinge })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-ink-500 dark:text-ink-400">Swing</span>
            <Segmented
              size="sm"
              label="Swing direction"
              value={opening.swing}
              options={[
                { value: 'in', label: 'In' },
                { value: 'out', label: 'Out' },
              ]}
              onChange={(swing) => updateOpening(opening.id, { swing })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function RoomPanel() {
  const doc = useEditor((s) => s.doc);
  const setRoomDimensions = useEditor((s) => s.setRoomDimensions);
  const setWallColor = useEditor((s) => s.setWallColor);
  const setWallPattern = useEditor((s) => s.setWallPattern);
  const setFloor = useEditor((s) => s.setFloor);
  const setUnit = useEditor((s) => s.setUnit);
  const addOpening = useEditor((s) => s.addOpening);
  const addPartition = useEditor((s) => s.addPartition);
  const removePartition = useEditor((s) => s.removePartition);
  const select = useEditor((s) => s.select);
  const selection = useEditor((s) => s.selection);

  const currency = useUI((s) => s.currency);
  const showDimensions = useUI((s) => s.showDimensions);
  const setShowDimensions = useUI((s) => s.setShowDimensions);
  const showClearance = useUI((s) => s.showClearance);
  const setShowClearance = useUI((s) => s.setShowClearance);
  const showGrid = useUI((s) => s.showGrid);
  const setShowGrid = useUI((s) => s.setShowGrid);
  const snap = useUI((s) => s.snap);
  const setSnap = useUI((s) => s.setSnap);
  const openModal = useUI((s) => s.openModal);

  const unit = doc.unit;
  const dims = doc.room.dimensions;

  const area = floorArea(dims);
  const occupied = useMemo(() => occupiedFloorArea(doc.furniture), [doc.furniture]);
  const cost = useMemo(() => totalCost(doc.furniture), [doc.furniture]);
  const density = area > 0 ? Math.min(1, occupied / area) : 0;

  const lengthField = (
    label: string,
    key: 'width' | 'length' | 'height' | 'wallThickness',
    min: number,
    max: number
  ) => (
    <NumberField
      key={key}
      label={label}
      suffix={unitLabel(unit)}
      value={toDisplay(dims[key], unit)}
      min={toDisplay(min, unit)}
      max={toDisplay(max, unit)}
      step={0.01}
      format={(v) => v.toFixed(2)}
      parse={(t) => {
        const m = parseLength(t, unit);
        return m === null ? null : toDisplay(m, unit);
      }}
      onChange={(v) => setRoomDimensions({ [key]: fromDisplay(v, unit) })}
    />
  );

  return (
    <>
      <Section title="Dimensions" icon="ruler">
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">Units</span>
          <Segmented
            size="sm"
            label="Measurement units"
            value={unit}
            options={[
              { value: 'm', label: 'Metres' },
              { value: 'ft', label: 'Feet' },
            ]}
            onChange={setUnit}
          />
        </div>
        {lengthField('Width', 'width', ROOM_LIMITS.minWidth, ROOM_LIMITS.maxWidth)}
        {lengthField('Length', 'length', ROOM_LIMITS.minLength, ROOM_LIMITS.maxLength)}
        {lengthField('Wall height', 'height', ROOM_LIMITS.minHeight, ROOM_LIMITS.maxHeight)}
        {lengthField(
          'Wall thickness',
          'wallThickness',
          ROOM_LIMITS.minWallThickness,
          ROOM_LIMITS.maxWallThickness
        )}
        <p className="text-[11px] text-ink-400">
          Width and length are interior measurements — the usable floor.
        </p>
      </Section>

      <Section title="Openings" icon="door">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" icon="plus" onClick={() => addOpening('door', 'south')}>
            Door
          </Button>
          <Button size="sm" icon="plus" onClick={() => addOpening('window', 'north')}>
            Window
          </Button>
        </div>
        {doc.room.openings.length === 0 ? (
          <p className="text-caption text-ink-400">
            No doors or windows yet. Openings stay attached to their wall when you
            resize the room.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {doc.room.openings.map((o) => (
              <OpeningRow key={o.id} id={o.id} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Interior Partition Walls" icon="layers">
        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
            Add divider or wall
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" icon="plus" onClick={() => addPartition('full')}>
              Full Wall
            </Button>
            <Button size="sm" icon="plus" onClick={() => addPartition('half')}>
              Half Wall
            </Button>
            <Button size="sm" icon="plus" onClick={() => addPartition('screen')}>
              Divider
            </Button>
          </div>
        </div>

        {(doc.room.partitions ?? []).length === 0 ? (
          <p className="text-caption text-ink-400">
            No interior walls yet. Add one to divide open-plan rooms, define alcoves, or create half-wall kitchen counters.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(doc.room.partitions ?? []).map((p) => {
              const active = selection.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => select(p.id)}
                  className={clsx(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-control border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-sage-500 bg-sage-50/60 text-sage-900 dark:bg-sage-950/30 dark:text-sage-100'
                      : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800'
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-caption font-medium">
                      {p.name || 'Interior Wall'}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {formatLength(p.length, unit)} · {formatLength(p.height, unit)} tall
                    </p>
                  </div>
                  <IconButton
                    size="sm"
                    icon="trash"
                    label="Delete wall"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePartition(p.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Finishes" icon="sparkle">
        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
            Wall pattern
          </span>
          <div role="radiogroup" aria-label="Wall pattern" className="grid grid-cols-3 gap-1.5">
            {WALL_PATTERNS.map((p) => {
              const active = (doc.room.walls.pattern ?? 'plain') === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setWallPattern(p.id)}
                  className={clsx(
                    'flex flex-col items-start gap-0.5 rounded-control border p-1.5 text-left text-[11px]',
                    'transition-colors duration-150',
                    active
                      ? 'border-sage-500 bg-sage-50 text-sage-800 dark:bg-sage-900/30 dark:text-sage-100'
                      : 'border-ink-200 text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300'
                  )}
                >
                  <span className="font-medium truncate w-full">{p.name}</span>
                  <span className="text-[9px] text-ink-400 leading-tight truncate w-full">
                    {p.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
            Wall colour
          </span>
          <SwatchGrid
            label="Wall colour"
            colors={WALL_COLORS.map((c) => ({ color: c.color, name: c.name }))}
            value={doc.room.walls.color}
            onChange={setWallColor}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
            Flooring
          </span>
          <div role="radiogroup" aria-label="Flooring" className="grid grid-cols-2 gap-1.5">
            {FLOOR_PRESETS.map((preset) => {
              const active =
                doc.room.floor.color === preset.color &&
                doc.room.floor.pattern === preset.pattern;
              return (
                <button
                  key={preset.name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFloor({ color: preset.color, pattern: preset.pattern })}
                  className={clsx(
                    'flex items-center gap-2 rounded-control border px-2 py-1.5 text-left text-[11px]',
                    'transition-colors duration-150',
                    active
                      ? 'border-sage-500 bg-sage-50 text-sage-800 dark:bg-sage-900/30 dark:text-sage-100'
                      : 'border-ink-200 text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300'
                  )}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded border border-black/10"
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="truncate">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Guides & snapping" icon="magnet" defaultOpen={false}>
        <Switch label="Show dimensions" checked={showDimensions} onChange={setShowDimensions} />
        <Switch
          label="Show clearance zones"
          description="Space each item needs to be usable"
          checked={showClearance}
          onChange={setShowClearance}
        />
        <Switch label="Show grid" checked={showGrid} onChange={setShowGrid} />
        <div className="h-px bg-ink-200 dark:bg-ink-800" />
        <Switch label="Snap to walls" checked={snap.wall} onChange={(wall) => setSnap({ wall })} />
        <Switch
          label="Snap to furniture"
          checked={snap.furniture}
          onChange={(furniture) => setSnap({ furniture })}
        />
        <Switch label="Snap to grid" checked={snap.grid} onChange={(grid) => setSnap({ grid })} />
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
            Rotation step
          </span>
          <Segmented
            size="sm"
            label="Rotation snapping"
            value={String(snap.rotationStep)}
            options={[
              { value: '0', label: 'Free' },
              { value: '15', label: '15°' },
              { value: '45', label: '45°' },
              { value: '90', label: '90°' },
            ]}
            onChange={(v) => setSnap({ rotationStep: Number(v) })}
          />
        </div>
        <p className="text-[11px] text-ink-400">Hold Alt while dragging to ignore snapping.</p>
      </Section>

      <Section title="Summary" icon="receipt">
        <dl className="flex flex-col gap-1.5 text-caption">
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Floor area</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {formatArea(area, unit)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Furniture</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {doc.furniture.length} items
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Floor used</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {Math.round(density * 100)}%
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Estimated cost</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {formatCurrency(cost, currency)}
            </dd>
          </div>
        </dl>

        {/* Density bar doubles as a crowding warning. */}
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-300',
                density > 0.6 ? 'bg-warn' : 'bg-sage-500'
              )}
              style={{ width: `${Math.round(density * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-400">
            {density > 0.6
              ? 'Above 60% floor coverage a room starts to feel crowded.'
              : 'Comfortable amount of open floor.'}
          </p>
        </div>

        <Button size="sm" icon="receipt" block onClick={() => openModal('summary')}>
          Full shopping list
        </Button>
        <p className="text-[11px] text-ink-400">
          Room is {formatLength(dims.width, unit)} × {formatLength(dims.length, unit)}.
        </p>
      </Section>
    </>
  );
}
