import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type { CatalogItem } from '@/types';
import { CATALOG, CATEGORIES, getCatalogItem, searchCatalog } from '@/data/catalog';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { formatLengthShort } from '@/utils/units';
import { formatCurrency } from '@/utils/exporters';
import { Icon } from './Icon';
import { EmptyState, Skeleton, Tooltip } from './primitives';
import { CustomModelUpload } from './CustomModelUpload';

/**
 * Furniture catalog sidebar.
 *
 * ACCESSIBILITY DECISION: drag-and-drop is an accelerator, never the only way
 * in. Every card is a real button — Enter or the ⊕ control places the item at
 * the first free spot in the room. A planner that can only be operated by
 * dragging is unusable with a keyboard, a switch device, or a trackpad the user
 * finds awkward.
 *
 * Search is debounced through `useDeferredValue` rather than a timer: React
 * keeps the input responsive and drops intermediate renders on its own, which
 * is both simpler and more correct than a hand-rolled 200 ms setTimeout.
 */

const DRAG_MIME = 'application/x-roomcraft-catalog-id';

function ThumbnailShape({ item }: { item: CatalogItem }) {
  // A 2D plan silhouette of the item's real footprint. It communicates the one
  // thing that matters when choosing furniture for a room — proportion.
  const ratio = item.size.w / item.size.d;
  const maxW = 62;
  const maxH = 46;
  const w = ratio >= maxW / maxH ? maxW : maxH * ratio;
  const h = ratio >= maxW / maxH ? maxW / ratio : maxH;
  const color = item.finishes[0]?.color ?? '#a3b18a';

  return (
    <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden="true">
      <rect x="0" y="0" width="80" height="60" rx="6" className="fill-sage-50 dark:fill-ink-800" />
      <rect
        x={40 - w / 2}
        y={30 - h / 2}
        width={w}
        height={h}
        rx={Math.min(4, Math.min(w, h) / 4)}
        fill={color}
        opacity="0.9"
      />
      <rect
        x={40 - w / 2}
        y={30 - h / 2}
        width={w}
        height={Math.max(3, h * 0.22)}
        rx="2"
        fill="#344e41"
        opacity="0.22"
      />
    </svg>
  );
}

function CatalogCard({ item }: { item: CatalogItem }) {
  const addFurniture = useEditor((s) => s.addFurniture);
  const unit = useEditor((s) => s.doc.unit);
  const currency = useUI((s) => s.currency);
  const favorites = useUI((s) => s.favorites);
  const toggleFavorite = useUI((s) => s.toggleFavorite);
  const noteCatalogUse = useUI((s) => s.noteCatalogUse);
  const setDragCatalogId = useUI((s) => s.setDragCatalogId);
  const toast = useUI((s) => s.toast);

  const isFavorite = favorites.includes(item.id);

  const place = () => {
    const id = addFurniture(item.id);
    if (id) {
      noteCatalogUse(item.id);
    } else {
      toast('Could not place that item', { tone: 'error' });
    }
  };

  return (
    <div className="group relative">
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, item.id);
          e.dataTransfer.setData('text/plain', item.name);
          e.dataTransfer.effectAllowed = 'copy';
          setDragCatalogId(item.id);
        }}
        onDragEnd={() => setDragCatalogId(null)}
        onClick={place}
        aria-label={`Add ${item.name}, ${formatLengthShort(item.size.w, unit)} by ${formatLengthShort(item.size.d, unit)}`}
        className={clsx(
          'flex w-full cursor-grab flex-col overflow-hidden rounded-panel border text-left',
          'border-ink-200 bg-white transition-all duration-150 ease-out',
          'hover:border-sage-400 hover:shadow-subtle active:cursor-grabbing',
          'dark:border-ink-800 dark:bg-ink-900 dark:hover:border-sage-600'
        )}
      >
        <div className="aspect-square w-full p-2">
          <ThumbnailShape item={item} />
        </div>
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          <span className="truncate text-caption font-medium text-ink-800 dark:text-sage-50">
            {item.name}
          </span>
          <span className="text-[11px] tabular-nums text-ink-400">
            {formatLengthShort(item.size.w, unit)} × {formatLengthShort(item.size.d, unit)}
            {item.price > 0 && ` · ${formatCurrency(item.price, currency)}`}
          </span>
        </div>
      </button>

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
        <Tooltip content={isFavorite ? 'Remove from favourites' : 'Add to favourites'}>
          <button
            type="button"
            aria-label={isFavorite ? `Unfavourite ${item.name}` : `Favourite ${item.name}`}
            aria-pressed={isFavorite}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            className={clsx(
              'flex h-6 w-6 items-center justify-center rounded-control bg-white/95 shadow-subtle',
              'transition-colors duration-150 dark:bg-ink-800/95',
              isFavorite ? 'text-sage-600' : 'text-ink-400 hover:text-ink-700'
            )}
          >
            <Icon name={isFavorite ? 'star-filled' : 'star'} filled={isFavorite} className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>

      {/* Persistent favourite marker, visible without hover. */}
      {isFavorite && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 text-sage-600 opacity-100 group-hover:opacity-0">
          <Icon name="star-filled" filled className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-panel border border-ink-200 dark:border-ink-800">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-1 p-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </div>
  );
}

export function Catalog() {
  const open = useUI((s) => s.catalogOpen);
  const toggle = useUI((s) => s.toggleCatalog);
  const category = useUI((s) => s.activeCategory);
  const setCategory = useUI((s) => s.setActiveCategory);
  const query = useUI((s) => s.catalogQuery);
  const setQuery = useUI((s) => s.setCatalogQuery);
  const favorites = useUI((s) => s.favorites);
  const recent = useUI((s) => s.recentCatalog);
  const reducedMotion = useUI((s) => s.reducedMotion);

  const searchRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);

  // The skeleton is shown for one paint so the grid never pops in with a layout
  // shift. Matching the real card dimensions exactly is the whole point.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchCatalog(deferredQuery, category),
    [deferredQuery, category]
  );

  const favoriteItems = useMemo(
    () =>
      favorites
        .map(getCatalogItem)
        .filter((i): i is CatalogItem => i !== undefined),
    [favorites]
  );
  const recentItems = useMemo(
    () =>
      recent.map(getCatalogItem).filter((i): i is CatalogItem => i !== undefined),
    [recent]
  );

  const showShortcuts = deferredQuery.trim() === '' && category === 'all';

  // Ctrl/Cmd+F focuses catalog search — the shortcut people already have muscle
  // memory for, without stealing the browser's own find when a field is active.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggle(true);
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <>
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="catalog"
            initial={reducedMotion ? { opacity: 0 } : { x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { x: -280, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Furniture catalog"
            className="z-20 flex h-full w-[280px] shrink-0 flex-col border-r border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
          >
            {/* Sticky category tabs */}
            <div className="sticky top-0 z-10 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-800 dark:bg-ink-900/95">
              <div
                role="tablist"
                aria-label="Furniture categories"
                className="scroll-thin flex gap-0.5 overflow-x-auto px-2 pt-2"
              >
                <CategoryTab
                  active={category === 'all'}
                  onClick={() => setCategory('all')}
                  label="All"
                  icon="layers"
                />
                {CATEGORIES.map((c) => (
                  <CategoryTab
                    key={c.id}
                    active={category === c.id}
                    onClick={() => setCategory(c.id)}
                    label={c.label}
                    path={c.icon}
                  />
                ))}
              </div>

              <div className="relative p-3">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-[22px] top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search furniture…"
                  aria-label="Search furniture"
                  className="h-9 w-full rounded-control border border-ink-200 bg-ink-50 pl-9 pr-3 text-body transition-colors duration-150 placeholder:text-ink-400 focus:border-sage-500 focus:bg-white dark:border-ink-700 dark:bg-ink-800 dark:text-sage-50"
                />
              </div>
            </div>

            <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-6">
              {!ready ? (
                <div className="grid grid-cols-2 gap-2 pt-3">
                  {Array.from({ length: 8 }, (_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="No matches"
                  description={`Nothing in the catalog matches “${query}”. Try a broader term, or switch to All.`}
                />
              ) : (
                <>
                  {showShortcuts && favoriteItems.length > 0 && (
                    <CardGroup title="Favourites" items={favoriteItems} />
                  )}
                  {showShortcuts && recentItems.length > 0 && (
                    <CardGroup title="Recently used" items={recentItems} />
                  )}
                  <CardGroup
                    title={
                      showShortcuts
                        ? 'All furniture'
                        : `${results.length} result${results.length === 1 ? '' : 's'}`
                    }
                    items={results}
                  />
                </>
              )}
            </div>

            <CustomModelUpload />

            <p className="border-t border-ink-200 px-3 py-2 text-[11px] text-ink-400 dark:border-ink-800">
              Drag into the room, or press Enter on a card to place it.
            </p>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Edge tab — always visible, the way professional tools do it. */}
      <div className="z-30 flex items-center">
        <Tooltip content={open ? 'Hide catalog' : 'Show catalog'} side="bottom">
          <button
            type="button"
            onClick={() => toggle()}
            aria-label={open ? 'Hide catalog' : 'Show catalog'}
            aria-expanded={open}
            className={clsx(
              'flex h-16 w-4 items-center justify-center rounded-r-control',
              'border border-l-0 border-ink-200 bg-white text-ink-400',
              'transition-colors duration-150 hover:bg-ink-50 hover:text-ink-700',
              'dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-800'
            )}
          >
            <Icon name={open ? 'chevron-left' : 'chevron-right'} className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
    </>
  );
}

function CardGroup({ title, items }: { title: string; items: CatalogItem[] }) {
  return (
    <section className="pt-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <CatalogCard key={`${title}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function CategoryTab({
  active,
  onClick,
  label,
  icon,
  path,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: 'layers';
  path?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'relative flex shrink-0 flex-col items-center gap-1 px-2.5 pb-2 pt-1.5',
        'text-[11px] font-medium transition-colors duration-150',
        active ? 'text-sage-700 dark:text-sage-300' : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
      )}
    >
      {icon ? (
        <Icon name={icon} className="h-4 w-4" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={path} />
        </svg>
      )}
      {label}
      {active && (
        <motion.span
          layoutId="category-underline"
          className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full bg-sage-600"
        />
      )}
    </button>
  );
}

export { DRAG_MIME };
export const CATALOG_SIZE = CATALOG.length;
