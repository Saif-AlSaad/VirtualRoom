import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Scene } from './canvas/Scene';
import { TopBar } from './ui/TopBar';
import { Catalog, DRAG_MIME } from './ui/Catalog';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { ContextToolbar, MiniMap, PresentationExit, ViewportControls } from './ui/Overlays';
import { Onboarding } from './ui/Onboarding';
import { Modals } from './ui/Modals';
import { Icon } from './ui/Icon';
import { IconButton } from './ui/primitives';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { pickFloor } from '@/utils/pointer';
import { useAutosave, useOnlineStatus } from '@/hooks/useAutosave';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

/**
 * The editor shell.
 *
 * Layout is a three-column flex row with a full-bleed canvas in the middle and
 * absolutely-positioned overlays on top of it. The canvas is never inset by
 * chrome — panels sit beside it, floating controls sit over it.
 *
 * Catalog drops are handled here rather than inside the R3F canvas because
 * HTML5 drag events never reach WebGL content. The drop point is unprojected
 * onto the floor plane through the bridge registered by `Bridges`.
 */
export function Editor() {
  const addFurniture = useEditor((s) => s.addFurniture);
  const catalogOpen = useUI((s) => s.catalogOpen);
  const propertiesOpen = useUI((s) => s.propertiesOpen);
  const setPropertiesOpen = useUI((s) => s.setPropertiesOpen);
  const presentation = useUI((s) => s.presentationMode);
  const dragCatalogId = useUI((s) => s.dragCatalogId);
  const setDragCatalogId = useUI((s) => s.setDragCatalogId);
  const noteCatalogUse = useUI((s) => s.noteCatalogUse);
  const openModal = useUI((s) => s.openModal);
  const toast = useUI((s) => s.toast);

  const [dropActive, setDropActive] = useState(false);

  useAutosave(true);
  useOnlineStatus();
  useKeyboardShortcuts(true);

  // Tablet and below: panels become drawers, closed by default so the canvas
  // keeps priority. See README for the responsive scope decision.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1279px)');
    const apply = () => {
      if (query.matches) {
        useUI.getState().toggleCatalog(false);
        useUI.getState().setPropertiesOpen(false);
      }
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDropActive(false);
      setDragCatalogId(null);

      const catalogId = event.dataTransfer.getData(DRAG_MIME);
      if (!catalogId) return;

      // Unproject the drop point onto the floor. If the camera is edge-on to
      // the floor there is no intersection — fall back to the free-spot search.
      const point = pickFloor(event.clientX, event.clientY);
      const id = addFurniture(catalogId, point ?? undefined);

      if (id) noteCatalogUse(catalogId);
      else toast('Could not place that item', { tone: 'error' });
    },
    [addFurniture, noteCatalogUse, setDragCatalogId, toast]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-50 dark:bg-ink-950">
      {!presentation && <TopBar />}

      <div className="relative flex min-h-0 flex-1">
        {!presentation && <Catalog />}

        {/* Canvas column */}
        <main
          className="relative min-w-0 flex-1"
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setDropActive(true);
          }}
          onDragLeave={(event) => {
            // Only clear when the pointer genuinely left the drop target, not
            // when it crossed onto a child element.
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            setDropActive(false);
          }}
          onDrop={onDrop}
        >
          <Scene />

          {/* Drop affordance */}
          <AnimatePresence>
            {dropActive && dragCatalogId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute inset-3 rounded-panel border-2 border-dashed border-sage-500 bg-sage-500/5"
              >
                <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-control bg-sage-700 px-2.5 py-1 text-caption font-medium text-sage-50 shadow-medium">
                  Drop to place
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <ViewportControls />
          <MiniMap />
          <ContextToolbar />
          <Onboarding />
          <PresentationExit />

          {/* Help + reset, tucked bottom-right out of the way. */}
          {!presentation && (
            <div className="absolute bottom-6 right-6 z-20 flex gap-1.5">
              <span className="glass rounded-control shadow-subtle">
                <IconButton
                  icon="trash"
                  label="Remove all furniture"
                  onClick={() => openModal('confirm-reset')}
                />
              </span>
              <span className="glass rounded-control shadow-subtle">
                <IconButton
                  icon="keyboard"
                  label="Keyboard shortcuts (?)"
                  onClick={() => openModal('shortcuts')}
                />
              </span>
            </div>
          )}
        </main>

        {!presentation && <PropertiesPanel />}

        {/* Edge tab to reopen the properties panel, mirroring the catalog's. */}
        {!presentation && !propertiesOpen && (
          <div className="z-30 flex items-center">
            <button
              type="button"
              onClick={() => setPropertiesOpen(true)}
              aria-label="Show properties panel"
              aria-expanded={false}
              className={clsx(
                'flex h-16 w-4 items-center justify-center rounded-l-control',
                'border border-r-0 border-ink-200 bg-white text-ink-400',
                'transition-colors duration-150 hover:bg-ink-50 hover:text-ink-700',
                'dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-800'
              )}
            >
              <Icon name="chevron-left" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <Modals />

      {/* Screen-reader-only live description of the layout state. */}
      <SelectionAnnouncer />
      <span className="sr-only">{catalogOpen ? 'Catalog open' : 'Catalog closed'}</span>
    </div>
  );
}

/** Announces selection changes to assistive technology. */
function SelectionAnnouncer() {
  const selection = useEditor((s) => s.selection);
  const furniture = useEditor((s) => s.doc.furniture);

  const message =
    selection.length === 0
      ? 'Nothing selected'
      : selection.length === 1
        ? `Selected ${
            furniture.find((f) => f.instanceId === selection[0])?.catalogId ?? 'item'
          }`
        : `${selection.length} items selected`;

  return (
    <span aria-live="polite" className="sr-only">
      {message}
    </span>
  );
}
