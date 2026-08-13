import type { Project, Unit } from '@/types';
import { serializeProject } from './schema';
import { shoppingList, totalCost } from './placement';
import { floorArea, netWallArea } from './roomGeometry';
import { formatArea, formatLength } from './units';
import { captureViewport } from './capture';

/**
 * Export formats.
 *
 * Each exporter documents its own limitations — an export the user
 * misunderstands is worse than one that does not exist.
 */

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'room'
  );
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export type ExportResult = { ok: true } | { ok: false; error: string };

/**
 * PNG of the 3D viewport.
 *
 * LIMITATION: captures the WebGL canvas only — UI overlays, dimension labels
 * and the minimap are not included. That is intentional; it is what makes the
 * output usable as a presentation image.
 */
export function exportPNG(project: Project, scale = 2): ExportResult {
  const dataUrl = captureViewport(scale);
  if (!dataUrl) {
    return {
      ok: false,
      error: 'The 3D view is not ready yet. Wait for the scene to load and try again.',
    };
  }
  triggerDownload(dataUrl, `${slugify(project.name)}-${scale}x.png`);
  return { ok: true };
}

/**
 * Full project JSON.
 *
 * This is the lossless format — everything the app knows, including instance
 * ids, notes and lock state. It is the one to use for backup and for moving a
 * design between browsers.
 */
export function exportJSON(project: Project): ExportResult {
  try {
    const blob = new Blob([serializeProject(project)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${slugify(project.name)}.roomcraft.json`);
    // Revoke on the next tick — revoking synchronously races the click in
    // Firefox and yields an empty file.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not build the export file.' };
  }
}

/** Reads a user-selected file as text, with a size guard. */
export function readFileAsText(file: File, maxBytes = 8 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error('That file is too large to be a RoomCraft project.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;'
  );

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain number rather than throwing.
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

/**
 * Print-ready design report.
 *
 * Opens a self-contained HTML document in a new window and calls print(), so
 * the user can "print to PDF" with the browser's own dialog. No PDF library is
 * shipped — the browser already has one, and a 400 kB dependency to duplicate
 * it would be a poor trade.
 */
export function exportReport(
  project: Project,
  opts: { currency: string; screenshot?: string | null }
): ExportResult {
  const unit: Unit = project.unit;
  const dims = project.room.dimensions;
  const list = shoppingList(project.furniture);
  const total = totalCost(project.furniture);
  const shot = opts.screenshot ?? captureViewport(2);

  const rows = list
    .map(
      (l) => `<tr>
        <td>${escapeHtml(l.name)}</td>
        <td class="num">${l.quantity}</td>
        <td class="num">${escapeHtml(formatCurrency(l.unitPrice, opts.currency))}</td>
        <td class="num">${escapeHtml(formatCurrency(l.total, opts.currency))}</td>
      </tr>`
    )
    .join('');

  const openings = project.room.openings
    .map(
      (o) =>
        `<li>${o.kind === 'door' ? 'Door' : 'Window'} — ${o.wall} wall, ${escapeHtml(
          formatLength(o.width, unit)
        )} × ${escapeHtml(formatLength(o.height, unit))}</li>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(project.name)} — design report</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.55 Inter, system-ui, sans-serif; color: #1a1a1a; margin: 40px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e4e4e7; }
  .meta { color: #71717a; font-size: 12px; }
  img { width: 100%; border-radius: 12px; margin-top: 16px; border: 1px solid #e4e4e7; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #ececef; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #71717a; }
  .num { text-align: right; }
  tfoot td { font-weight: 600; border-top: 2px solid #1a1a1a; border-bottom: none; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; }
  .grid div { display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f2; padding: 6px 0; }
  ul { margin: 8px 0; padding-left: 18px; }
  @media print { body { margin: 16mm; } }
</style></head><body>
<h1>${escapeHtml(project.name)}</h1>
<div class="meta">RoomCraft design report · ${new Date().toLocaleDateString()} · measurements in ${
    unit === 'm' ? 'metres' : 'feet and inches'
  }</div>
${shot ? `<img src="${shot}" alt="3D view of ${escapeHtml(project.name)}">` : ''}

<h2>Room</h2>
<div class="grid">
  <div><span>Width</span><strong>${escapeHtml(formatLength(dims.width, unit))}</strong></div>
  <div><span>Length</span><strong>${escapeHtml(formatLength(dims.length, unit))}</strong></div>
  <div><span>Height</span><strong>${escapeHtml(formatLength(dims.height, unit))}</strong></div>
  <div><span>Wall thickness</span><strong>${escapeHtml(formatLength(dims.wallThickness, unit))}</strong></div>
  <div><span>Floor area</span><strong>${escapeHtml(formatArea(floorArea(dims), unit))}</strong></div>
  <div><span>Net wall area</span><strong>${escapeHtml(
    formatArea(netWallArea(dims, project.room.openings), unit)
  )}</strong></div>
</div>
${openings ? `<h2>Openings</h2><ul>${openings}</ul>` : ''}

<h2>Furniture (${project.furniture.length} items)</h2>
<table>
  <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="4">No furniture placed.</td></tr>'}</tbody>
  <tfoot><tr><td colspan="3">Estimated total</td><td class="num">${escapeHtml(
    formatCurrency(total, opts.currency)
  )}</td></tr></tfoot>
</table>
<p class="meta">Prices are indicative catalog values for planning only.</p>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!win) {
    return {
      ok: false,
      error: 'Your browser blocked the report window. Allow pop-ups for this site.',
    };
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give images a moment to decode before the print dialog measures the page.
  setTimeout(() => win.print(), 400);
  return { ok: true };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context and permission; fall back to the
    // legacy path so http://localhost and older Safari still work.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
