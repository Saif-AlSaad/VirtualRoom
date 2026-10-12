import type { CatalogItem } from '@/types';

/**
 * Procedural architectural 2D illustrations for catalog furniture cards.
 *
 * Replaces generic flat rectangular boxes with detailed, recognizable
 * plan/isometric architectural representations of each furniture piece
 * while preserving realistic proportional width and depth scaling.
 */

function adjustHex(hex: string, percent: number): string {
  try {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return hex;
    const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * (percent / 100))));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100))));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(255 * (percent / 100))));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch {
    return hex;
  }
}

export function FurnitureThumbnail({ item }: { item: CatalogItem }) {
  const ratio = Math.max(0.25, Math.min(4, item.size.w / item.size.d));
  const maxW = 58;
  const maxH = 44;
  const w = ratio >= maxW / maxH ? maxW : maxH * ratio;
  const h = ratio >= maxW / maxH ? maxW / ratio : maxH;

  const baseColor = item.finishes[0]?.color ?? '#a3b18a';
  const darkColor = adjustHex(baseColor, -18);
  const deepColor = adjustHex(baseColor, -32);
  const lightColor = adjustHex(baseColor, 16);
  const highlightColor = adjustHex(baseColor, 32);

  const cx = 40;
  const cy = 30;
  const x = cx - w / 2;
  const y = cy - h / 2;

  // Render distinct realistic architectural elements per model kind
  const renderIllustration = () => {
    switch (item.model) {
      case 'armchair': {
        const armW = Math.max(4, w * 0.22);
        const backH = Math.max(5, h * 0.26);
        return (
          <g>
            {/* Tapered wooden legs */}
            <circle cx={x + 3} cy={y + 3} r="1.8" fill="#5c4033" />
            <circle cx={x + w - 3} cy={y + 3} r="1.8" fill="#5c4033" />
            <circle cx={x + 3} cy={y + h - 3} r="1.8" fill="#5c4033" />
            <circle cx={x + w - 3} cy={y + h - 3} r="1.8" fill="#5c4033" />

            {/* Armchair base shell */}
            <rect x={x} y={y} width={w} height={h} rx="6" fill={darkColor} />

            {/* Plush backrest */}
            <rect x={x + 2} y={y + 1} width={w - 4} height={backH} rx="3" fill={deepColor} />
            <line x1={x + 5} y1={y + backH * 0.5} x2={x + w - 5} y2={y + backH * 0.5} stroke={darkColor} strokeWidth="1" strokeDasharray="2,2" />

            {/* Left & Right contoured armrests */}
            <rect x={x + 1} y={y + backH} width={armW} height={h - backH - 2} rx="3" fill={baseColor} />
            <rect x={x + w - armW - 1} y={y + backH} width={armW} height={h - backH - 2} rx="3" fill={baseColor} />

            {/* Plump seat cushion */}
            <rect
              x={x + armW + 1}
              y={y + backH + 1}
              width={w - 2 * armW - 2}
              height={h - backH - 3}
              rx="3.5"
              fill={lightColor}
              stroke={darkColor}
              strokeWidth="0.8"
            />
          </g>
        );
      }

      case 'sofa': {
        const isThree = w >= 42;
        const cushions = isThree ? 3 : 2;
        const armW = Math.max(3.5, w * 0.12);
        const backH = Math.max(4, h * 0.24);
        const seatW = w - 2 * armW - 2;
        const cW = seatW / cushions;

        return (
          <g>
            {/* Corner legs */}
            <circle cx={x + 3} cy={y + 3} r="1.6" fill="#5c4033" />
            <circle cx={x + w - 3} cy={y + 3} r="1.6" fill="#5c4033" />
            <circle cx={x + 3} cy={y + h - 3} r="1.6" fill="#5c4033" />
            <circle cx={x + w - 3} cy={y + h - 3} r="1.6" fill="#5c4033" />

            {/* Main sofa frame shell */}
            <rect x={x} y={y} width={w} height={h} rx="5" fill={darkColor} />

            {/* Backrest frame & cushions */}
            <rect x={x + 2} y={y + 1} width={w - 4} height={backH} rx="2.5" fill={deepColor} />
            {Array.from({ length: cushions }).map((_, i) => (
              <rect
                key={`bc-${i}`}
                x={x + armW + 1 + i * cW}
                y={y + 1}
                width={cW - 1}
                height={backH}
                rx="2"
                fill={darkColor}
                stroke={deepColor}
                strokeWidth="0.6"
              />
            ))}

            {/* Left and right padded armrests */}
            <rect x={x + 1} y={y + backH} width={armW} height={h - backH - 2} rx="2.5" fill={baseColor} />
            <rect x={x + w - armW - 1} y={y + backH} width={armW} height={h - backH - 2} rx="2.5" fill={baseColor} />

            {/* Individual seat cushions with tailored piping */}
            {Array.from({ length: cushions }).map((_, i) => (
              <rect
                key={`sc-${i}`}
                x={x + armW + 1 + i * cW}
                y={y + backH + 1}
                width={cW - 1}
                height={h - backH - 3}
                rx="2.5"
                fill={lightColor}
                stroke={darkColor}
                strokeWidth="0.7"
              />
            ))}

            {/* Throw cushions at ends */}
            <rect x={x + armW + 2} y={y + backH + 2} width={3.5} height={h * 0.45} rx="1.5" fill={highlightColor} />
            <rect x={x + w - armW - 5.5} y={y + backH + 2} width={3.5} height={h * 0.45} rx="1.5" fill={highlightColor} />
          </g>
        );
      }

      case 'coffeeTable': {
        const slatCount = Math.max(3, Math.round(w / 12));
        return (
          <g>
            {/* Lower shelf slats */}
            <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx="2" fill={deepColor} opacity="0.6" />
            {Array.from({ length: slatCount }).map((_, i) => {
              const sx = x + 6 + (i * (w - 12)) / (slatCount - 1);
              return <line key={i} x1={sx} y1={y + 4} x2={sx} y2={y + h - 4} stroke={darkColor} strokeWidth="1" />;
            })}

            {/* Tapered corner legs with brass caps */}
            <circle cx={x + 3.5} cy={y + 3.5} r="2.2" fill="#c59b27" />
            <circle cx={x + w - 3.5} cy={y + 3.5} r="2.2" fill="#c59b27" />
            <circle cx={x + 3.5} cy={y + h - 3.5} r="2.2" fill="#c59b27" />
            <circle cx={x + w - 3.5} cy={y + h - 3.5} r="2.2" fill="#c59b27" />

            {/* Beveled tabletop slab */}
            <rect x={x} y={y} width={w} height={h} rx="4" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />
            <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx="3" fill={lightColor} opacity="0.5" />

            {/* Coffee table tray / design accent */}
            <rect x={cx - w * 0.16} y={cy - h * 0.22} width={w * 0.32} height={h * 0.44} rx="1.5" fill={deepColor} opacity="0.35" />
          </g>
        );
      }

      case 'bed': {
        const isDouble = w >= 34;
        const headH = Math.max(4, h * 0.14);
        const duvetH = (h - headH) * 0.64;
        const turnSheetH = Math.max(3, duvetH * 0.16);
        const pillowW = isDouble ? (w - 7) / 2 : w - 8;
        const pillowH = Math.max(5, (h - headH) * 0.24);

        return (
          <g>
            {/* Upholstered headboard with vertical channel stitching */}
            <rect x={x - 1} y={y} width={w + 2} height={headH} rx="2" fill={deepColor} />
            {Array.from({ length: 5 }).map((_, i) => {
              const lx = x + ((i + 1) * w) / 6;
              return <line key={i} x1={lx} y1={y + 1} x2={lx} y2={y + headH - 1} stroke={darkColor} strokeWidth="0.8" />;
            })}

            {/* Bed frame & base sheet */}
            <rect x={x} y={y + headH} width={w} height={h - headH} rx="3" fill="#f7f5ed" stroke={darkColor} strokeWidth="0.8" />

            {/* Sleeping pillows with realistic fold creases */}
            {isDouble ? (
              <>
                <rect x={x + 2.5} y={y + headH + 2} width={pillowW} height={pillowH} rx="2.5" fill="#ffffff" stroke="#dad7cd" strokeWidth="0.7" />
                <line x1={x + 2.5 + pillowW * 0.3} y1={y + headH + 3} x2={x + 2.5 + pillowW * 0.7} y2={y + headH + pillowH - 3} stroke="#e4e1d8" strokeWidth="0.6" />

                <rect x={x + 4.5 + pillowW} y={y + headH + 2} width={pillowW} height={pillowH} rx="2.5" fill="#ffffff" stroke="#dad7cd" strokeWidth="0.7" />
                <line x1={x + 4.5 + pillowW * 1.3} y1={y + headH + 3} x2={x + 4.5 + pillowW * 1.7} y2={y + headH + pillowH - 3} stroke="#e4e1d8" strokeWidth="0.6" />
              </>
            ) : (
              <rect x={x + 4} y={y + headH + 2} width={pillowW} height={pillowH} rx="2.5" fill="#ffffff" stroke="#dad7cd" strokeWidth="0.7" />
            )}

            {/* Main folded-down duvet / comforter */}
            <rect
              x={x + 0.5}
              y={y + h - duvetH}
              width={w - 1}
              height={duvetH}
              rx="3"
              fill={baseColor}
              stroke={darkColor}
              strokeWidth="0.7"
            />

            {/* Turned-down sheet fold showing contrasting crisp white linen */}
            <rect
              x={x + 0.5}
              y={y + h - duvetH}
              width={w - 1}
              height={turnSheetH}
              rx="1.5"
              fill="#faf8f2"
              stroke="#dad7cd"
              strokeWidth="0.6"
            />

            {/* Decorative throw runner at bed foot */}
            <rect x={x + 1} y={y + h - 5} width={w - 2} height="3.5" rx="1" fill={darkColor} opacity="0.6" />
          </g>
        );
      }

      case 'wardrobe': {
        const isTriple = w >= 44;
        const doors = isTriple ? 3 : 2;
        const doorW = (w - 2) / doors;

        return (
          <g>
            {/* Top crown cornice moulding */}
            <rect x={x - 1} y={y} width={w + 2} height="2.5" rx="1" fill={deepColor} />

            {/* Wardrobe carcass frame */}
            <rect x={x} y={y + 2.5} width={w} height={h - 2.5} rx="2" fill={darkColor} stroke={deepColor} strokeWidth="0.8" />

            {/* Shaker panel doors */}
            {Array.from({ length: doors }).map((_, i) => {
              const dx = x + 1 + i * doorW;
              return (
                <g key={`door-${i}`}>
                  {/* Door leaf boundary */}
                  <rect x={dx} y={y + 3.5} width={doorW - 0.8} height={h - 5} rx="1.5" fill={baseColor} />
                  {/* Recessed shaker inner panel */}
                  <rect
                    x={dx + 2}
                    y={y + 5.5}
                    width={doorW - 4.8}
                    height={h - 9}
                    rx="1"
                    fill={lightColor}
                    stroke={darkColor}
                    strokeWidth="0.6"
                  />
                  {/* Sleek metallic bar handles */}
                  <line
                    x1={i % 2 === 0 ? dx + doorW - 2.5 : dx + 2}
                    y1={y + h * 0.42}
                    x2={i % 2 === 0 ? dx + doorW - 2.5 : dx + 2}
                    y2={y + h * 0.62}
                    stroke="#d4d8dc"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
        );
      }

      case 'dresser': {
        const mirrorW = Math.max(12, w * 0.6);
        const mirrorH = Math.max(12, h * 0.48);
        return (
          <g>
            {/* Vanity desk tabletop */}
            <rect x={x} y={y + h * 0.35} width={w} height={h * 0.65} rx="3" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />

            {/* Drawers with brass handles */}
            <line x1={x + 2} y1={y + h * 0.68} x2={x + w - 2} y2={y + h * 0.68} stroke={deepColor} strokeWidth="0.8" />
            <circle cx={x + w * 0.3} cy={y + h * 0.52} r="1.4" fill="#c59b27" />
            <circle cx={x + w * 0.7} cy={y + h * 0.52} r="1.4" fill="#c59b27" />
            <circle cx={x + w * 0.3} cy={y + h * 0.82} r="1.4" fill="#c59b27" />
            <circle cx={x + w * 0.7} cy={y + h * 0.82} r="1.4" fill="#c59b27" />

            {/* Vanity Mirror (Arched with brass bezel & reflection) */}
            <rect
              x={cx - mirrorW / 2}
              y={y + 1}
              width={mirrorW}
              height={mirrorH}
              rx={mirrorW * 0.45}
              fill="#d9e6ed"
              stroke="#c59b27"
              strokeWidth="1.5"
            />
            {/* Glass reflection glint */}
            <line
              x1={cx - mirrorW * 0.25}
              y1={y + 3}
              x2={cx + mirrorW * 0.2}
              y2={y + mirrorH - 3}
              stroke="#ffffff"
              strokeWidth="1.4"
              opacity="0.65"
            />
          </g>
        );
      }

      case 'desk': {
        return (
          <g>
            {/* Main desktop surface */}
            <rect x={x} y={y} width={w} height={h} rx="3" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />
            {/* Desktop work mat / laptop zone */}
            <rect x={cx - w * 0.25} y={cy - h * 0.25} width={w * 0.5} height={h * 0.5} rx="1.5" fill={deepColor} opacity="0.35" />
            {/* Cable grommet */}
            <circle cx={x + w - 4} cy={y + 4} r="1.5" fill="#333333" />
            {/* Right drawer pedestal */}
            <line x1={x + w * 0.68} y1={y + 2} x2={x + w * 0.68} y2={y + h - 2} stroke={darkColor} strokeWidth="0.8" />
            <line x1={x + w * 0.76} y1={y + h * 0.5} x2={x + w * 0.9} y2={y + h * 0.5} stroke="#d4d8dc" strokeWidth="1.4" />
          </g>
        );
      }

      case 'diningTable': {
        return (
          <g>
            {/* Corner legs */}
            <circle cx={x + 3.5} cy={y + 3.5} r="2.2" fill="#5c4033" />
            <circle cx={x + w - 3.5} cy={y + 3.5} r="2.2" fill="#5c4033" />
            <circle cx={x + 3.5} cy={y + h - 3.5} r="2.2" fill="#5c4033" />
            <circle cx={x + w - 3.5} cy={y + h - 3.5} r="2.2" fill="#5c4033" />

            {/* Tabletop slab with chamfered edge */}
            <rect x={x} y={y} width={w} height={h} rx="4" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />
            <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx="3" fill={lightColor} opacity="0.4" />
            <line x1={x + 4} y1={cy} x2={x + w - 4} y2={cy} stroke={deepColor} strokeWidth="0.6" strokeDasharray="3,3" opacity="0.4" />
          </g>
        );
      }

      case 'diningChair':
      case 'patioChair': {
        return (
          <g>
            {/* 4 chair legs */}
            <circle cx={x + 2} cy={y + 2} r="1.4" fill="#5c4033" />
            <circle cx={x + w - 2} cy={y + 2} r="1.4" fill="#5c4033" />
            <circle cx={x + 2} cy={y + h - 2} r="1.4" fill="#5c4033" />
            <circle cx={x + w - 2} cy={y + h - 2} r="1.4" fill="#5c4033" />

            {/* Curved slatted backrest */}
            <rect x={x + 1} y={y} width={w - 2} height="3" rx="1.5" fill={deepColor} />
            {/* Contoured seat pad */}
            <rect x={x + 1.5} y={y + 3.5} width={w - 3} height={h - 4.5} rx="3" fill={baseColor} stroke={darkColor} strokeWidth="0.7" />
          </g>
        );
      }

      case 'officeChair': {
        return (
          <g>
            {/* 5-star swivel castor base */}
            {Array.from({ length: 5 }).map((_, i) => {
              const a = (i * Math.PI * 2) / 5;
              const lx = cx + Math.cos(a) * (w * 0.42);
              const ly = cy + Math.sin(a) * (h * 0.42);
              return <line key={i} x1={cx} y1={cy} x2={lx} y2={ly} stroke="#2b2d30" strokeWidth="1.6" strokeLinecap="round" />;
            })}
            <circle cx={cx} cy={cy} r="3" fill="#1e2022" />

            {/* Waterfall contoured seat cushion */}
            <rect x={cx - w * 0.34} y={cy - h * 0.28} width={w * 0.68} height={h * 0.56} rx="4" fill={baseColor} />

            {/* Ergonomic mesh backrest */}
            <rect x={cx - w * 0.3} y={y + 1} width={w * 0.6} height={h * 0.28} rx="3" fill={deepColor} />
            {/* Armrest loops */}
            <rect x={cx - w * 0.45} y={cy - h * 0.15} width="2.5" height={h * 0.38} rx="1" fill="#2b2d30" />
            <rect x={cx + w * 0.45 - 2.5} y={cy - h * 0.15} width="2.5" height={h * 0.38} rx="1" fill="#2b2d30" />
          </g>
        );
      }

      case 'bookshelf': {
        const shelves = Math.max(3, Math.round(h / 8));
        return (
          <g>
            {/* Outer bookcase carcass */}
            <rect x={x} y={y} width={w} height={h} rx="2" fill={deepColor} />
            {/* Inner shelves & book spines */}
            {Array.from({ length: shelves }).map((_, i) => {
              const sy = y + 2 + (i * (h - 4)) / shelves;
              const shH = (h - 4) / shelves - 1;
              return (
                <g key={i}>
                  <rect x={x + 1.5} y={sy} width={w - 3} height={shH} fill={baseColor} opacity="0.8" />
                  {/* Colored miniature book spines */}
                  <rect x={x + 3} y={sy + 0.5} width="2" height={shH - 1} fill="#b07d62" />
                  <rect x={x + 5.5} y={sy + 0.5} width="2.2" height={shH - 1} fill="#2f4058" />
                  <rect x={x + 8.2} y={sy + 0.5} width="1.8" height={shH - 1} fill="#588157" />
                  <rect x={x + 10.5} y={sy + 0.5} width="2" height={shH - 1} fill="#c59b27" />
                </g>
              );
            })}
          </g>
        );
      }

      case 'tvUnit': {
        return (
          <g>
            {/* Media console cabinet */}
            <rect x={x} y={y} width={w} height={h} rx="2.5" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />
            {/* Left and right cabinet doors */}
            <rect x={x + 1.5} y={y + 1.5} width={w * 0.35} height={h - 3} rx="1" fill={lightColor} stroke={darkColor} strokeWidth="0.5" />
            <rect x={x + w * 0.65 - 1.5} y={y + 1.5} width={w * 0.35} height={h - 3} rx="1" fill={lightColor} stroke={darkColor} strokeWidth="0.5" />
            {/* Center open AV shelf */}
            <rect x={cx - w * 0.12} y={cy - h * 0.3} width={w * 0.24} height={h * 0.6} rx="1" fill={deepColor} opacity="0.5" />
            {/* TV base stand indicator */}
            <rect x={cx - w * 0.22} y={y - 1} width={w * 0.44} height="1.8" rx="0.5" fill="#1e2022" />
          </g>
        );
      }

      case 'nightstand': {
        return (
          <g>
            {/* Bedside table surface */}
            <rect x={x} y={y} width={w} height={h} rx="2.5" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />
            {/* Top and bottom drawers */}
            <line x1={x + 1.5} y1={cy} x2={x + w - 1.5} y2={cy} stroke={deepColor} strokeWidth="0.8" />
            <circle cx={cx} cy={y + h * 0.28} r="1.3" fill="#c59b27" />
            <circle cx={cx} cy={y + h * 0.72} r="1.3" fill="#c59b27" />
          </g>
        );
      }

      case 'plant': {
        return (
          <g>
            {/* Ceramic pot */}
            <circle cx={cx} cy={cy} r={Math.min(w, h) * 0.32} fill="#b07d62" stroke="#8d5b43" strokeWidth="1" />
            {/* Lush green foliage leaves */}
            <circle cx={cx} cy={cy - 4} r="4.5" fill="#3a5a40" />
            <circle cx={cx - 4} cy={cy + 1} r="4.2" fill="#588157" />
            <circle cx={cx + 4} cy={cy + 1} r="4.2" fill="#588157" />
            <circle cx={cx - 2} cy={cy - 3} r="3.5" fill="#a3b18a" />
            <circle cx={cx + 2} cy={cy - 3} r="3.5" fill="#a3b18a" />
          </g>
        );
      }

      case 'floorLamp':
      case 'pendantLamp':
      case 'deskLamp': {
        return (
          <g>
            {/* Lamp base */}
            <circle cx={cx} cy={cy + h * 0.25} r={Math.min(w, h) * 0.28} fill="#2b2d30" />
            {/* Radial glow */}
            <circle cx={cx} cy={cy - h * 0.15} r={Math.min(w, h) * 0.42} fill="#ffecb3" opacity="0.45" />
            {/* Lampshade */}
            <circle cx={cx} cy={cy - h * 0.15} r={Math.min(w, h) * 0.3} fill="#ffffff" stroke="#c59b27" strokeWidth="1.2" />
          </g>
        );
      }

      case 'rug': {
        return (
          <g>
            {/* Textile woven rug body */}
            <rect x={x} y={y} width={w} height={h} rx="2" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />
            {/* Decorative inner border */}
            <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx="1.5" fill="none" stroke={lightColor} strokeWidth="1" strokeDasharray="2,2" />
            {/* Center motif */}
            <rect x={cx - w * 0.2} y={cy - h * 0.2} width={w * 0.4} height={h * 0.4} rx="1" fill={deepColor} opacity="0.3" />
            {/* Fringe tassels on top and bottom */}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`ft-${i}`} x1={x + 3 + (i * (w - 6)) / 5} y1={y - 1.5} x2={x + 3 + (i * (w - 6)) / 5} y2={y} stroke={lightColor} strokeWidth="0.8" />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`fb-${i}`} x1={x + 3 + (i * (w - 6)) / 5} y1={y + h} x2={x + 3 + (i * (w - 6)) / 5} y2={y + h + 1.5} stroke={lightColor} strokeWidth="0.8" />
            ))}
          </g>
        );
      }

      case 'bathtub': {
        return (
          <g>
            {/* Freestanding porcelain bathtub rim */}
            <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.35} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Inner basin with water reflection */}
            <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={Math.min(w, h) * 0.3} fill="#e0f2fe" stroke="#bae6fd" strokeWidth="0.8" />
            {/* Chrome mixer tap */}
            <circle cx={x + 5} cy={cy} r="1.4" fill="#94a3b8" />
            <line x1={x + 5} y1={cy} x2={x + 8} y2={cy} stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        );
      }

      case 'toilet': {
        return (
          <g>
            {/* Cistern tank */}
            <rect x={x} y={y} width={w} height={h * 0.35} rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx={cx} cy={y + h * 0.17} r="1.2" fill="#94a3b8" />
            {/* Elongated toilet bowl */}
            <ellipse cx={cx} cy={y + h * 0.65} rx={w * 0.42} ry={h * 0.3} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <ellipse cx={cx} cy={y + h * 0.65} rx={w * 0.28} ry={h * 0.2} fill="#f1f5f9" />
          </g>
        );
      }

      default: {
        // Fallback for custom uploads or generic items
        return (
          <g>
            <rect x={x} y={y} width={w} height={h} rx="3" fill={baseColor} stroke={darkColor} strokeWidth="0.8" />
            <rect x={x + 2} y={y + 2} width={w - 4} height={Math.max(3, h * 0.22)} rx="1.5" fill={deepColor} opacity="0.4" />
          </g>
        );
      }
    }
  };

  return (
    <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden="true">
      {/* Background container tile */}
      <rect x="0" y="0" width="80" height="60" rx="6" className="fill-sage-50/80 dark:fill-ink-800/80" />

      {/* Soft contact shadow beneath furniture */}
      <rect
        x={x + 1}
        y={y + 2}
        width={w}
        height={h}
        rx="4"
        fill="#000000"
        opacity="0.08"
      />

      {/* Architectural furniture drawing */}
      {renderIllustration()}
    </svg>
  );
}
