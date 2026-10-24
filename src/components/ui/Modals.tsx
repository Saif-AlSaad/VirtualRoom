import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '@/store/editorStore';
import { useProjects } from '@/store/projectsStore';
import { useUI } from '@/store/uiStore';
import { buildShareUrl, shareUrlLength } from '@/utils/shareLink';
import { copyToClipboard, formatCurrency, readFileAsText } from '@/utils/exporters';
import { parseProjectJSON } from '@/utils/schema';
import { shoppingList, totalCost } from '@/utils/placement';
import { floorArea } from '@/utils/roomGeometry';
import { formatArea } from '@/utils/units';
import { Icon } from './Icon';
import { Button, EmptyState, Segmented, Switch, TextField } from './primitives';
import { ConfirmDialog, Modal } from './Modal';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

/** All dialogs, mounted once and driven by `uiStore.modal`. */
export function Modals() {
  const modal = useUI((s) => s.modal);
  const closeModal = useUI((s) => s.closeModal);

  return (
    <>
      <ShareModal open={modal === 'share'} onClose={closeModal} />
      <SummaryModal open={modal === 'summary'} onClose={closeModal} />
      <ShortcutsModal open={modal === 'shortcuts'} onClose={closeModal} />
      <ImportModal open={modal === 'import'} onClose={closeModal} />
      <AboutModal open={modal === 'about'} onClose={closeModal} />
      <ResetConfirm open={modal === 'confirm-reset'} onClose={closeModal} />
    </>
  );
}

// ── Share ────────────────────────────────────────────────────────────────

function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const toast = useUI((s) => s.toast);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => (open ? buildShareUrl(doc) : ''), [doc, open]);
  const length = useMemo(() => (open ? shareUrlLength(doc) : 0), [doc, open]);
  // Some chat clients and older proxies truncate beyond ~2000 characters.
  const tooLong = length > 2000;

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this room"
      description="The entire layout is encoded in the link itself — there is no server involved."
      footer={
        <>
          <Button onClick={onClose}>Done</Button>
          <Button
            variant="primary"
            icon={copied ? 'check' : 'copy'}
            onClick={async () => {
              const ok = await copyToClipboard(url);
              setCopied(ok);
              toast(ok ? 'Link copied' : 'Could not copy — select and copy manually', {
                tone: ok ? 'success' : 'error',
              });
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <textarea
          readOnly
          value={url}
          rows={4}
          aria-label="Shareable link"
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-none rounded-control border border-ink-200 bg-ink-50 p-2.5 font-mono text-[11px] leading-relaxed text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
        />

        <div className="flex items-center justify-between text-caption">
          <span className="text-ink-400">{length.toLocaleString()} characters</span>
          {tooLong && (
            <span className="flex items-center gap-1.5 text-warn">
              <Icon name="alert" className="h-3.5 w-3.5" />
              Long link — some apps may truncate it
            </span>
          )}
        </div>

        <div className="rounded-panel bg-ink-50 p-3 text-caption text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
          <p className="mb-1.5 font-medium text-ink-800 dark:text-sage-50">
            What the link contains
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>Room dimensions, finishes, doors and windows</li>
            <li>Every placed item, with position, rotation, scale and colour</li>
            <li>
              <strong>Not</strong> your project name history, notes, or anything else in
              this browser
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-ink-400">
            The data sits after the <code>#</code>, so it is never sent to a web server.
            Anyone with the link can open a copy; they cannot change yours.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ── Cost summary / shopping list ─────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'BDT', 'JPY', 'AUD', 'CAD'];

function SummaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const currency = useUI((s) => s.currency);
  const setCurrency = useUI((s) => s.setCurrency);

  const list = useMemo(() => shoppingList(doc.furniture), [doc.furniture]);
  const total = useMemo(() => totalCost(doc.furniture), [doc.furniture]);
  const area = floorArea(doc.room.dimensions);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Shopping list"
      description={`${doc.furniture.length} items across ${formatArea(area, doc.unit)} of floor.`}
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {list.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="Nothing placed yet"
          description="Add furniture to the room and it will be costed here automatically."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-caption text-ink-500 dark:text-ink-400">Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Currency"
              className="h-8 rounded-control border border-ink-200 bg-white px-2 text-caption dark:border-ink-700 dark:bg-ink-800 dark:text-sage-50"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <table className="w-full text-caption">
            <thead>
              <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                <th className="pb-2 font-semibold">Item</th>
                <th className="pb-2 text-right font-semibold">Qty</th>
                <th className="pb-2 text-right font-semibold">Unit</th>
                <th className="pb-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={row.catalogId}
                  className="border-b border-ink-100 last:border-b-0 dark:border-ink-800/60"
                >
                  <td className="py-2 text-ink-800 dark:text-sage-50">{row.name}</td>
                  <td className="py-2 text-right tabular-nums text-ink-500">{row.quantity}</td>
                  <td className="py-2 text-right tabular-nums text-ink-500">
                    {formatCurrency(row.unitPrice, currency)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums text-ink-900 dark:text-sage-50">
                    {formatCurrency(row.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-900 dark:border-sage-100">
                <td className="pt-2 font-semibold text-ink-900 dark:text-sage-50" colSpan={3}>
                  Estimated total
                </td>
                <td className="pt-2 text-right font-semibold tabular-nums text-ink-900 dark:text-sage-50">
                  {formatCurrency(total, currency)}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="text-[11px] text-ink-400">
            Catalog prices are indicative planning figures, not quotes. Use Export → Design
            report for a printable version.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>();
    for (const s of SHORTCUTS) {
      const list = map.get(s.group);
      if (list) list.push(s);
      else map.set(s.group, [s]);
    }
    return [...map.entries()];
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Everything in the editor is reachable without a mouse."
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map(([group, items]) => (
          <section key={group}>
            <h3 className="mb-2 text-caption font-semibold uppercase tracking-wide text-ink-400">
              {group}
            </h3>
            <dl className="flex flex-col gap-1.5">
              {items.map((s) => (
                <div key={s.keys} className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-ink-600 dark:text-ink-300">{s.label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {s.keys.split('+').map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}

// ── Import ───────────────────────────────────────────────────────────────

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadProject = useEditor((s) => s.loadProject);
  const save = useProjects((s) => s.save);
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const text = await readFileAsText(file);
      const result = parseProjectJSON(text);
      if (!result.ok) {
        toast('Import failed', { description: result.error, tone: 'error' });
        return;
      }
      save(result.project);
      loadProject(result.project);
      if (result.warnings.length > 0) {
        toast('Imported with changes', {
          description: result.warnings.slice(0, 2).join(' '),
          tone: 'warning',
        });
      } else {
        toast('Project imported', { tone: 'success' });
      }
      onClose();
    } catch (error) {
      toast('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import a project"
      description="Opens a .roomcraft.json file exported from RoomCraft."
      footer={<Button onClick={onClose}>Cancel</Button>}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handle(file);
        }}
        className={`flex flex-col items-center gap-3 rounded-panel border-2 border-dashed p-8 text-center transition-colors duration-150 ${
          dragOver
            ? 'border-sage-500 bg-sage-50 dark:bg-sage-900/20'
            : 'border-ink-300 dark:border-ink-700'
        }`}
      >
        <Icon name="upload" className="h-6 w-6 text-ink-400" />
        <p className="text-body text-ink-600 dark:text-ink-300">
          Drop a project file here, or
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handle(file);
            e.target.value = '';
          }}
        />
        <Button variant="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Reading…' : 'Choose a file'}
        </Button>
        <p className="text-[11px] text-ink-400">
          Imported files are validated before they are loaded. Items that are not in this
          catalog are skipped and reported.
        </p>
      </div>
    </Modal>
  );
}

// ── About / storage diagnostics ──────────────────────────────────────────

function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toProject = useEditor((s) => s.toProject);
  const saveStatus = useEditor((s) => s.saveStatus);
  const quality = useUI((s) => s.quality);
  const setQuality = useUI((s) => s.setQuality);
  const postFx = useUI((s) => s.postFx);
  const setPostFx = useUI((s) => s.setPostFx);
  const project = useMemo(() => (open ? toProject() : null), [open, toProject]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="About & diagnostics"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-5">
        {saveStatus === 'failed' && (
          <div className="rounded-panel border border-danger/40 bg-danger/10 p-3">
            <p className="text-caption font-medium text-danger">Saving is currently failing</p>
            <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-300">
              Browser storage is most likely full. Your current room is still intact in
              memory — export it as a project file now, then delete an old project from the
              dashboard to free space.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-body text-ink-700 dark:text-ink-200">Rendering quality</p>
            <p className="text-caption text-ink-400">
              Lower it if the viewport feels sluggish on this machine.
            </p>
          </div>
          <Segmented
            size="sm"
            label="Rendering quality"
            value={quality}
            options={[
              { value: 'high', label: 'High' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'performance', label: 'Fast' },
            ]}
            onChange={setQuality}
          />
        </div>

        {/* Studio Visual Fidelity & Post-Processing */}
        <div className="flex flex-col gap-2.5 rounded-panel border border-ink-200/80 bg-ink-50/70 p-3 dark:border-ink-800 dark:bg-ink-800/40">
          <div className="flex items-center gap-1.5 font-medium text-caption text-ink-800 dark:text-sage-50">
            <Icon name="sparkle" className="h-4 w-4 text-sage-600 dark:text-sage-400" />
            <span>Studio Visual Effects</span>
          </div>
          <Switch
            label="Post-Processing Passes"
            description="SSAO ambient occlusion, bloom glare, and environment reflections"
            checked={postFx.enabled}
            onChange={(enabled) => setPostFx({ enabled })}
          />
          {postFx.enabled && quality !== 'performance' && (
            <div className="mt-1 flex flex-col gap-2 border-t border-ink-200/60 pt-2 text-caption dark:border-ink-800/60">
              <Switch
                label="Ambient Occlusion (SSAO)"
                description="Contact shadows grounding furniture and wall corners"
                checked={postFx.ssao}
                onChange={(ssao) => setPostFx({ ssao })}
              />
              <Switch
                label="Studio Reflections (PBR)"
                description="Physically-based radiance on glossy and metallic finishes"
                checked={postFx.reflections}
                onChange={(reflections) => setPostFx({ reflections })}
              />
              <Switch
                label="Architectural Bloom"
                description="Soft glare on window daylight and warm light fixtures"
                checked={postFx.bloom}
                onChange={(bloom) => setPostFx({ bloom })}
              />
              <Switch
                label="Cinematic Vignette"
                description="Subtle photographic camera edge falloff"
                checked={postFx.vignette}
                onChange={(vignette) => setPostFx({ vignette })}
              />
            </div>
          )}
        </div>

        <dl className="flex flex-col gap-1.5 text-caption">
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">App version</dt>
            <dd className="tabular-nums text-ink-800 dark:text-sage-50">1.0.0</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Project schema</dt>
            <dd className="tabular-nums text-ink-800 dark:text-sage-50">
              v{project?.schemaVersion ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Storage</dt>
            <dd className="text-ink-800 dark:text-sage-50">This browser only</dd>
          </div>
        </dl>

        <p className="text-[11px] leading-relaxed text-ink-400">
          RoomCraft stores every project in this browser's localStorage. Nothing is sent to
          a server, there are no accounts and no analytics. Clearing site data will delete
          your rooms — export anything you want to keep.
        </p>
      </div>
    </Modal>
  );
}

// ── Reset confirmation ───────────────────────────────────────────────────

function ResetConfirm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clearFurniture = useEditor((s) => s.clearFurniture);
  const count = useEditor((s) => s.doc.furniture.length);
  const toast = useUI((s) => s.toast);

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => {
        clearFurniture();
        toast('All furniture removed', { description: 'Ctrl+Z will bring it back.' });
      }}
      title="Remove all furniture?"
      message={`This clears all ${count} placed items. The room itself, its doors and windows are kept — and you can undo this with Ctrl+Z.`}
      confirmLabel="Remove all"
    />
  );
}

/** Small helper used by the onboarding hint. */
export function InlineField(props: Parameters<typeof TextField>[0]) {
  return <TextField {...props} />;
}
