import type { JSX } from 'react';
import type { ModelKind } from '@/types';
import { Cushion, Cyl, Legs, Panels, Slab, neutral, shade } from './primitives';

/**
 * Procedural furniture geometry.
 *
 * WHY NOT .glb: every model here is generated from its catalog dimensions, so a
 * "1.5 m wardrobe" is genuinely 1.5 m of geometry rather than a fixed mesh
 * stretched to fit. That means scaling stays honest, there is nothing to
 * download before the first frame, and there is no third-party asset licence to
 * track. The trade is stylisation: these read as clean furniture forms, not
 * photoreal scans.
 *
 * The loader boundary in `FurnitureModel.tsx` is a plain switch on `ModelKind`,
 * so swapping any single entry for a real glTF later touches one case and
 * nothing else.
 *
 * Local frame for every builder: origin at footprint centre, base at y = 0,
 * facing local +Z.
 */

export interface ModelProps {
  w: number;
  d: number;
  h: number;
  color: string;
  roughness: number;
  metalness: number;
  lightOn?: boolean;
  lightColor?: string;
  lightIntensity?: number;
}

type Builder = (p: ModelProps) => JSX.Element;

const upholstered = (p: ModelProps, cushions: number): JSX.Element => {
  const { w, d, h, color, roughness } = p;
  const arm = Math.min(0.18, w * 0.13);
  const backD = Math.min(0.18, d * 0.2);
  const legH = 0.12;
  const seatTop = h * 0.5;
  const frame = shade(color, -0.06);
  const legColor = neutral(color, 0.22);
  const seatW = w - arm * 2;
  const seatD = d - backD;
  const each = seatW / cushions;

  return (
    <group>
      {/* Tapered round legs */}
      <Legs w={w} d={d} height={legH} color={legColor} thickness={0.045} inset={0.05} round />
      {/* Metallic brass ferrules on leg feet */}
      {[
        [w / 2 - 0.05 - 0.022, 0.015, d / 2 - 0.05 - 0.022],
        [-w / 2 + 0.05 + 0.022, 0.015, d / 2 - 0.05 - 0.022],
        [w / 2 - 0.05 - 0.022, 0.015, -d / 2 + 0.05 + 0.022],
        [-w / 2 + 0.05 + 0.022, 0.015, -d / 2 + 0.05 + 0.022],
      ].map((pos, idx) => (
        <Cyl
          key={`ferrule-${idx}`}
          at={pos as [number, number, number]}
          radius={0.024}
          height={0.03}
          color="#c59b27"
          metalness={0.85}
          roughness={0.25}
          segments={10}
        />
      ))}

      {/* Plinth base the cushions sit on */}
      <Slab
        at={[0, legH + (seatTop - legH) / 2, 0]}
        size={[w, d, seatTop - legH]}
        color={frame}
        roughness={roughness}
      />
      {/* Back rest, tilted slightly for ergonomic silhouette */}
      <Slab
        at={[0, seatTop + (h - seatTop) / 2, -d / 2 + backD / 2]}
        size={[w, backD, h - seatTop]}
        color={color}
        roughness={roughness}
        rotX={-0.04}
      />

      {/* Arms core slabs */}
      <Slab
        at={[w / 2 - arm / 2, legH + (h * 0.78 - legH) / 2, 0]}
        size={[arm, d, h * 0.78 - legH]}
        color={color}
        roughness={roughness}
      />
      <Slab
        at={[-w / 2 + arm / 2, legH + (h * 0.78 - legH) / 2, 0]}
        size={[arm, d, h * 0.78 - legH]}
        color={color}
        roughness={roughness}
      />
      {/* Padded upholstered armrest toppers */}
      <Cushion
        at={[w / 2 - arm / 2, h * 0.78 + 0.01, 0]}
        size={[arm + 0.012, d - 0.02, 0.04]}
        color={shade(color, 0.03)}
        radius={0.025}
      />
      <Cushion
        at={[-w / 2 + arm / 2, h * 0.78 + 0.01, 0]}
        size={[arm + 0.012, d - 0.02, 0.04]}
        color={shade(color, 0.03)}
        radius={0.025}
      />

      {/* Seat cushions with piping radius */}
      {Array.from({ length: cushions }, (_, i) => (
        <Cushion
          key={i}
          at={[-seatW / 2 + each * (i + 0.5), seatTop, backD / 2]}
          size={[each - 0.02, seatD - 0.02, 0.15]}
          color={shade(color, 0.05)}
          radius={0.045}
        />
      ))}
      {/* Back cushions */}
      {Array.from({ length: cushions }, (_, i) => (
        <Cushion
          key={`b${i}`}
          at={[
            -seatW / 2 + each * (i + 0.5),
            seatTop + 0.14,
            -d / 2 + backD + 0.07,
          ]}
          size={[each - 0.04, 0.14, h - seatTop - 0.16]}
          color={shade(color, 0.02)}
          radius={0.04}
        />
      ))}

      {/* Accent Throw Pillows */}
      {cushions >= 2 ? (
        <>
          <Cushion
            at={[w / 2 - arm - 0.08, seatTop + 0.14, -d * 0.06]}
            size={[0.24, 0.1, 0.24]}
            color={shade(color, 0.14)}
            radius={0.04}
            rotY={-0.35}
          />
          <Cushion
            at={[-w / 2 + arm + 0.08, seatTop + 0.14, -d * 0.06]}
            size={[0.24, 0.1, 0.24]}
            color={shade(color, 0.14)}
            radius={0.04}
            rotY={0.35}
          />
        </>
      ) : (
        /* Armchair lumbar cushion */
        <Cushion
          at={[0, seatTop + 0.08, -d / 2 + backD + 0.06]}
          size={[seatW * 0.72, 0.09, 0.18]}
          color={shade(color, 0.1)}
          radius={0.035}
        />
      )}
    </group>
  );
};

const carcass = (
  p: ModelProps,
  opts: {
    doors: number;
    horizontal?: boolean;
    plinth?: number;
    open?: boolean;
    shelves?: number;
  }
): JSX.Element => {
  const { w, d, h, color, roughness, metalness } = p;
  const plinth = opts.plinth ?? 0.06;
  const body = h - plinth;
  const wall = 0.02;
  const handle = neutral(color, 0.32);

  return (
    <group>
      <Slab at={[0, plinth / 2, 0]} size={[w * 0.94, d * 0.9, plinth]} color={shade(color, -0.2)} />
      {/* Carcass shell */}
      <Slab
        at={[0, plinth + body / 2, -d / 2 + wall / 2]}
        size={[w, wall, body]}
        color={shade(color, -0.1)}
        roughness={roughness}
      />
      <Slab at={[w / 2 - wall / 2, plinth + body / 2, 0]} size={[wall, d, body]} color={color} roughness={roughness} />
      <Slab at={[-w / 2 + wall / 2, plinth + body / 2, 0]} size={[wall, d, body]} color={color} roughness={roughness} />
      <Slab at={[0, h - wall / 2, 0]} size={[w, d, wall]} color={color} roughness={roughness} />
      <Slab at={[0, plinth + wall / 2, 0]} size={[w, d, wall]} color={color} roughness={roughness} />
      {opts.shelves
        ? Array.from({ length: opts.shelves }, (_, i) => (
            <Slab
              key={i}
              at={[0, plinth + (body / (opts.shelves! + 1)) * (i + 1), 0]}
              size={[w - wall * 2, d - wall, 0.018]}
              color={shade(color, -0.04)}
              roughness={roughness}
            />
          ))
        : null}
      {!opts.open && opts.doors > 0 && (
        <Panels
          count={opts.doors}
          w={w}
          h={body}
          y={plinth + body / 2}
          z={d / 2 - 0.01}
          color={shade(color, 0.04)}
          horizontal={opts.horizontal}
          handleColor={handle}
          depth={0.022}
        />
      )}
      {metalness > 0.4 && (
        <Slab
          at={[0, h + 0.001, 0]}
          size={[w, d, 0.004]}
          color={shade(color, 0.1)}
          metalness={metalness}
          roughness={0.3}
        />
      )}
    </group>
  );
};

const tableTop = (p: ModelProps, roundLegs: boolean): JSX.Element => {
  const { w, d, h, color, roughness, metalness } = p;
  const top = Math.min(0.05, h * 0.09);
  const legColor = metalness > 0.4 ? neutral(color, 0.24) : shade(color, -0.14);
  return (
    <group>
      <Slab
        at={[0, h - top / 2, 0]}
        size={[w, d, top]}
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
      {/* Apron ties the legs together and stops the top looking like it floats */}
      <Slab
        at={[0, h - top - 0.035, 0]}
        size={[w - 0.14, d - 0.14, 0.05]}
        color={shade(color, -0.1)}
        roughness={roughness}
      />
      <Legs
        w={w}
        d={d}
        height={h - top}
        color={legColor}
        thickness={roundLegs ? 0.06 : 0.07}
        inset={0.06}
        round={roundLegs}
      />
    </group>
  );
};

export const MODEL_BUILDERS: Record<ModelKind, Builder> = {
  // ── Seating ───────────────────────────────────────────────────────────
  sofa: (p) => upholstered(p, p.w > 1.8 ? 3 : 2),
  armchair: (p) => upholstered(p, 1),

  diningChair: (p) => {
    const { w, d, h, color, roughness } = p;
    const seatH = 0.45;
    return (
      <group>
        <Legs w={w} d={d} height={seatH} color={shade(color, -0.16)} thickness={0.035} inset={0.03} />
        <Slab at={[0, seatH, 0]} size={[w, d, 0.05]} color={color} roughness={roughness} />
        {/* Back uprights + three slats */}
        <Slab at={[w / 2 - 0.03, (seatH + h) / 2, -d / 2 + 0.03]} size={[0.035, 0.035, h - seatH]} color={shade(color, -0.1)} />
        <Slab at={[-w / 2 + 0.03, (seatH + h) / 2, -d / 2 + 0.03]} size={[0.035, 0.035, h - seatH]} color={shade(color, -0.1)} />
        {[0.55, 0.75, 0.95].map((f, i) => (
          <Slab
            key={i}
            at={[0, seatH + (h - seatH) * f - 0.03, -d / 2 + 0.03]}
            size={[w - 0.08, 0.025, 0.06]}
            color={color}
            roughness={roughness}
          />
        ))}
      </group>
    );
  },

  patioChair: (p) => {
    const { w, d, h, color, roughness } = p;
    const seatH = 0.42;
    return (
      <group>
        <Legs w={w} d={d} height={seatH} color={shade(color, -0.2)} thickness={0.04} inset={0.04} />
        {[0, 1, 2, 3].map((i) => (
          <Slab
            key={i}
            at={[0, seatH, -d / 2 + 0.08 + i * ((d - 0.14) / 3)]}
            size={[w - 0.04, (d - 0.2) / 4.4, 0.022]}
            color={color}
            roughness={roughness}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <Slab
            key={`b${i}`}
            at={[0, seatH + 0.09 + i * ((h - seatH - 0.1) / 3.4), -d / 2 + 0.05]}
            size={[w - 0.06, 0.022, (h - seatH) / 5.5]}
            color={color}
            roughness={roughness}
            rotX={-0.12}
          />
        ))}
      </group>
    );
  },

  officeChair: (p) => {
    const { w, h, color } = p;
    const base = neutral(color, 0.2);
    const seatH = h * 0.45;
    return (
      <group>
        {/* Five-star base */}
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <Slab at={[0, 0.05, w * 0.28]} size={[0.045, w * 0.52, 0.03]} color={base} metalness={0.5} roughness={0.4} />
              <Cyl at={[0, 0.025, w * 0.5]} radius={0.025} height={0.05} color={shade(base, -0.1)} segments={10} />
            </group>
          );
        })}
        <Cyl at={[0, seatH / 2, 0]} radius={0.035} height={seatH} color={base} metalness={0.6} roughness={0.3} segments={12} />
        <Cushion at={[0, seatH, 0]} size={[w * 0.75, w * 0.72, 0.09]} color={color} radius={0.05} />
        <Cushion
          at={[0, seatH + 0.12, -w * 0.3]}
          size={[w * 0.68, 0.09, h - seatH - 0.16]}
          color={shade(color, -0.04)}
          radius={0.04}
        />
        {/* Armrests */}
        {[-1, 1].map((s) => (
          <Slab
            key={s}
            at={[s * w * 0.38, seatH + 0.18, -0.02]}
            size={[0.05, w * 0.42, 0.03]}
            color={base}
            metalness={0.4}
          />
        ))}
      </group>
    );
  },

  // ── Tables ────────────────────────────────────────────────────────────
  coffeeTable: (p) => {
    const { w, d, h, color, roughness, metalness } = p;
    const topH = 0.032;
    const shelfH = 0.018;
    const shelfY = h * 0.32;
    const legColor = metalness > 0.4 ? neutral(color, 0.24) : shade(color, -0.16);

    return (
      <group>
        {/* Tabletop with chamfered edge */}
        <Slab at={[0, h - topH / 2, 0]} size={[w, d, topH]} color={color} roughness={roughness} metalness={metalness} />
        {/* Under-top apron frame */}
        <Slab at={[0, h - topH - 0.02, 0]} size={[w - 0.1, d - 0.1, 0.03]} color={shade(color, -0.12)} roughness={roughness} />
        {/* Lower slatted tier shelf for magazines/books */}
        <Slab at={[0, shelfY, 0]} size={[w - 0.12, d - 0.12, shelfH]} color={shade(color, -0.06)} roughness={roughness} />
        {/* 4 round legs with brass ferrules */}
        <Legs w={w} d={d} height={h - topH} color={legColor} thickness={0.045} inset={0.05} round />
        {/* Golden brass feet */}
        {([
          [w / 2 - 0.05 - 0.022, 0.015, d / 2 - 0.05 - 0.022],
          [-w / 2 + 0.05 + 0.022, 0.015, d / 2 - 0.05 - 0.022],
          [w / 2 - 0.05 - 0.022, 0.015, -d / 2 + 0.05 + 0.022],
          [-w / 2 + 0.05 + 0.022, 0.015, -d / 2 + 0.05 + 0.022],
        ] as [number, number, number][]).map((pos, idx) => (
          <Cyl key={idx} at={pos} radius={0.024} height={0.03} color="#c59b27" metalness={0.85} roughness={0.25} segments={10} />
        ))}
      </group>
    );
  },
  diningTable: (p) => tableTop(p, true),
  patioTable: (p) => tableTop(p, true),

  desk: (p) => {
    const { w, d, h, color, roughness, metalness } = p;
    const top = 0.04;
    const legColor = metalness > 0.4 ? neutral(color, 0.2) : shade(color, -0.14);
    return (
      <group>
        <Slab at={[0, h - top / 2, 0]} size={[w, d, top]} color={color} roughness={roughness} metalness={metalness} />
        {/* Solid side panels rather than four legs — reads as a desk instantly */}
        {[-1, 1].map((s) => (
          <Slab
            key={s}
            at={[s * (w / 2 - 0.025), (h - top) / 2, 0]}
            size={[0.05, d - 0.06, h - top]}
            color={legColor}
            roughness={0.5}
            metalness={metalness}
          />
        ))}
        {/* Modesty panel at the back */}
        <Slab
          at={[0, h * 0.62, -d / 2 + 0.05]}
          size={[w - 0.12, 0.025, h * 0.34]}
          color={shade(legColor, 0.05)}
        />
      </group>
    );
  },

  // ── Storage ───────────────────────────────────────────────────────────
  bookshelf: (p) => carcass(p, { doors: 0, open: true, shelves: Math.max(2, Math.round(p.h / 0.36) - 1) }),
  wardrobe: (p) => carcass(p, { doors: p.w > 1.25 ? 3 : 2, plinth: 0.08 }),
  nightstand: (p) => carcass(p, { doors: 2, horizontal: true, plinth: 0.07 }),
  filingCabinet: (p) => carcass(p, { doors: 3, horizontal: true, plinth: 0.05 }),
  sideboard: (p) => carcass(p, { doors: 3, plinth: 0.12 }),
  tvUnit: (p) => carcass(p, { doors: 2, plinth: 0.08 }),
  counter: (p) => {
    const { w, d, h, color } = p;
    const worktop = 0.04;
    return (
      <group>
        {carcass({ ...p, h: h - worktop }, { doors: Math.max(1, Math.round(w / 0.6)), plinth: 0.1 })}
        <Slab
          at={[0, h - worktop / 2, 0.006]}
          size={[w, d + 0.012, worktop]}
          color={shade(color, -0.28)}
          roughness={0.34}
          metalness={0.12}
        />
      </group>
    );
  },

  dresser: (p) => {
    // Dressing table: vanity desk with arched brass mirror and drawer pulls
    const { w, d, h } = p;
    const deskH = Math.min(0.78, h * 0.55);
    const mirrorH = h - deskH;
    return (
      <group>
        {carcass({ ...p, h: deskH }, { doors: 3, horizontal: true, plinth: 0.07 })}
        {/* Arched mirror frame in warm brushed brass */}
        <Slab
          at={[0, deskH + mirrorH / 2, -d / 2 + 0.03]}
          size={[w * 0.72, 0.035, mirrorH * 0.96]}
          color="#b08d4f"
          roughness={0.25}
          metalness={0.8}
        />
        {/* Reflective mirror surface */}
        <Slab
          at={[0, deskH + mirrorH / 2, -d / 2 + 0.05]}
          size={[w * 0.64, 0.01, mirrorH * 0.88]}
          color="#d6e4ec"
          roughness={0.04}
          metalness={0.92}
        />
        {/* Sleek drawer pull bars in brass */}
        {[-1, 0, 1].map((idx) => (
          <Slab
            key={idx}
            at={[0, deskH * 0.28 + (idx + 1) * (deskH * 0.2), d / 2 + 0.018]}
            size={[w * 0.26, 0.016, 0.016]}
            color="#b08d4f"
            roughness={0.25}
            metalness={0.8}
          />
        ))}
      </group>
    );
  },

  // ── Bedroom ───────────────────────────────────────────────────────────
  bed: (p) => {
    const { w, d, h, color, roughness } = p;
    const frameH = h * 0.42;
    const mattressH = h * 0.4;
    const headH = h * 1.25;
    const wood = shade(neutral(color, 0.3), 0);
    const isDouble = w > 1.1;

    return (
      <group>
        {/* Corner wooden bed posts/legs */}
        <Legs w={w + 0.02} d={d + 0.02} height={frameH} color={shade(wood, -0.15)} thickness={0.06} inset={0.02} />
        {/* Solid perimeter bed frame */}
        <Slab at={[0, frameH / 2, 0]} size={[w, d, frameH]} color={wood} roughness={0.6} />

        {/* Deep comfortable mattress with fitted sheet */}
        <Cushion
          at={[0, frameH, 0]}
          size={[w - 0.05, d - 0.05, mattressH]}
          color="#f5f3ec"
          radius={0.05}
        />

        {/* Layered duvet covering lower two thirds */}
        <Cushion
          at={[0, frameH + mattressH * 0.92, d * 0.14]}
          size={[w - 0.02, d * 0.66, 0.09]}
          color={color}
          roughness={roughness}
          radius={0.05}
        />

        {/* Turned-down sheet fold showing contrasting crisp white linen */}
        <Cushion
          at={[0, frameH + mattressH * 0.95, -d * 0.18]}
          size={[w - 0.03, 0.14, 0.05]}
          color="#fcfbf7"
          radius={0.025}
        />

        {/* Upholstered headboard with vertical channel stitching */}
        <Slab at={[0, headH / 2, -d / 2 - 0.03]} size={[w + 0.06, 0.07, headH]} color={color} roughness={roughness} />
        {/* Vertical channel ribs on headboard */}
        {[-0.35, -0.18, 0, 0.18, 0.35].map((xf, i) => (
          <Slab
            key={`rib-${i}`}
            at={[w * xf, headH / 2, -d / 2 + 0.008]}
            size={[0.016, 0.012, headH * 0.88]}
            color={shade(color, -0.08)}
            roughness={roughness}
          />
        ))}

        {/* Sleeping pillows */}
        {(isDouble ? [-1, 1] : [0]).map((s, i) => (
          <Cushion
            key={i}
            at={[s * (w * 0.24), frameH + mattressH + 0.03, -d / 2 + 0.26]}
            size={[isDouble ? w * 0.42 : w * 0.7, 0.32, 0.11]}
            color="#fbfaf6"
            radius={0.06}
          />
        ))}

        {/* Decorative accent throw pillows propped in front */}
        {isDouble && [-1, 1].map((s, i) => (
          <Cushion
            key={`dec-${i}`}
            at={[s * (w * 0.22), frameH + mattressH + 0.07, -d / 2 + 0.42]}
            size={[w * 0.28, 0.16, 0.1]}
            color={shade(color, 0.12)}
            radius={0.04}
            rotX={-0.15}
          />
        ))}
      </group>
    );
  },

  // ── Appliances ────────────────────────────────────────────────────────
  fridge: (p) => {
    const { w, d, h, color, roughness, metalness } = p;
    const handle = shade(color, -0.35);
    const splitY = h * 0.62;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={roughness} metalness={metalness} />
        {/* Door split line + two handles */}
        <Slab at={[0, splitY, d / 2 + 0.002]} size={[w, 0.006, 0.012]} color={shade(color, -0.25)} />
        <Slab at={[w * 0.34, splitY + (h - splitY) / 2, d / 2 + 0.02]} size={[0.03, 0.04, (h - splitY) * 0.55]} color={handle} metalness={0.7} roughness={0.3} />
        <Slab at={[w * 0.34, splitY / 2, d / 2 + 0.02]} size={[0.03, 0.04, splitY * 0.5]} color={handle} metalness={0.7} roughness={0.3} />
      </group>
    );
  },

  washingMachine: (p) => {
    const { w, d, h, color, roughness, metalness } = p;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={roughness} metalness={metalness} />
        <Slab at={[0, h - 0.08, d / 2 + 0.003]} size={[w * 0.92, 0.008, 0.11]} color={shade(color, -0.18)} />
        <Cyl
          at={[0, h * 0.45, d / 2 + 0.01]}
          radius={Math.min(w, h) * 0.29}
          height={0.03}
          color={shade(color, -0.3)}
          rotX={Math.PI / 2}
          segments={24}
          metalness={0.4}
        />
        <Cyl
          at={[0, h * 0.45, d / 2 + 0.026]}
          radius={Math.min(w, h) * 0.22}
          height={0.01}
          color="#2b3136"
          rotX={Math.PI / 2}
          segments={24}
          roughness={0.15}
          metalness={0.2}
        />
      </group>
    );
  },

  stove: (p) => {
    const { w, d, h, color, roughness, metalness } = p;
    return (
      <group>
        <Slab at={[0, h / 2 - 0.02, 0]} size={[w, d, h - 0.04]} color={color} roughness={roughness} metalness={metalness} />
        <Slab at={[0, h - 0.02, 0]} size={[w, d, 0.04]} color="#26282b" roughness={0.18} metalness={0.2} />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <Cyl
            key={i}
            at={[sx * w * 0.24, h + 0.004, sz * d * 0.2]}
            radius={w * 0.13}
            height={0.008}
            color="#3d4145"
            segments={20}
            roughness={0.3}
          />
        ))}
        {/* Oven door + glass */}
        <Slab at={[0, h * 0.42, d / 2 + 0.008]} size={[w * 0.9, 0.016, h * 0.55]} color={shade(color, -0.12)} metalness={metalness} />
        <Slab at={[0, h * 0.44, d / 2 + 0.02]} size={[w * 0.68, 0.008, h * 0.34]} color="#1c1f22" roughness={0.12} />
        <Slab at={[0, h * 0.74, d / 2 + 0.03]} size={[w * 0.86, 0.026, 0.026]} color={neutral(color, 0.35)} metalness={0.8} roughness={0.25} />
      </group>
    );
  },

  sink: (p) => {
    const { w, d, h, color, metalness } = p;
    const top = 0.04;
    return (
      <group>
        {carcass({ ...p, h: h - top }, { doors: 2, plinth: 0.1 })}
        <Slab at={[0, h - top / 2, 0]} size={[w, d, top]} color={shade(color, -0.15)} roughness={0.3} metalness={metalness} />
        {/* Recessed bowl */}
        <Slab at={[0, h - 0.06, 0.02]} size={[w * 0.55, d * 0.6, 0.09]} color={shade(color, -0.32)} roughness={0.16} metalness={0.7} />
        <Cyl at={[0, h + 0.11, -d * 0.3]} radius={0.016} height={0.22} color="#b9bec4" metalness={0.9} roughness={0.15} />
        <Slab at={[0, h + 0.21, -d * 0.22]} size={[0.03, 0.18, 0.03]} color="#b9bec4" metalness={0.9} roughness={0.15} />
      </group>
    );
  },

  // ── Office / media ────────────────────────────────────────────────────
  monitor: (p) => {
    const { w, d, h, color } = p;
    const screenH = h * 0.72;
    return (
      <group>
        <Slab at={[0, 0.01, 0]} size={[w * 0.45, d, 0.02]} color={neutral(color, 0.25)} metalness={0.5} roughness={0.4} />
        <Slab at={[0, h * 0.16, 0]} size={[0.05, 0.05, h * 0.3]} color={neutral(color, 0.25)} metalness={0.5} />
        <Slab at={[0, h - screenH / 2, 0]} size={[w, 0.022, screenH]} color={neutral(color, 0.16)} roughness={0.4} />
        <Slab at={[0, h - screenH / 2, 0.014]} size={[w - 0.03, 0.004, screenH - 0.03]} color="#1a2430" roughness={0.08} metalness={0.1} />
      </group>
    );
  },

  tvScreen: (p) => {
    const { w, d, h, color } = p;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={neutral(color, 0.14)} roughness={0.45} />
        <Slab at={[0, h / 2, d / 2 + 0.002]} size={[w - 0.03, 0.004, h - 0.03]} color="#141c26" roughness={0.06} metalness={0.15} />
      </group>
    );
  },

  // ── Bathroom ──────────────────────────────────────────────────────────
  toilet: (p) => {
    const { w, d, h, color, roughness } = p;
    const cisternH = h * 0.72;
    const seatH = h * 0.52;
    return (
      <group>
        {/* Cistern against the wall (local −Z) */}
        <Slab at={[0, cisternH / 2 + h * 0.14, -d / 2 + 0.09]} size={[w, 0.18, cisternH * 0.62]} color={color} roughness={roughness} />
        <Slab at={[0, h * 0.9, -d / 2 + 0.09]} size={[w * 0.9, 0.16, 0.02]} color={shade(color, -0.06)} />
        {/* Pedestal + bowl */}
        <Slab at={[0, seatH * 0.4, d * 0.02]} size={[w * 0.62, d * 0.42, seatH * 0.8]} color={color} roughness={roughness} />
        <Cyl at={[0, seatH - 0.03, d * 0.1]} radius={w * 0.48} height={0.14} color={color} segments={20} roughness={roughness} />
        <Cyl at={[0, seatH + 0.045, d * 0.1]} radius={w * 0.5} height={0.03} color={shade(color, -0.08)} segments={20} />
        <Cyl at={[0, seatH + 0.055, d * 0.1]} radius={w * 0.34} height={0.03} color={shade(color, -0.3)} segments={20} />
      </group>
    );
  },

  squatToilet: (p) => {
    const { w, d, h, color, roughness } = p;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={roughness} />
        {/* Recessed pan */}
        <Slab at={[0, h - 0.012, 0]} size={[w * 0.42, d * 0.66, 0.03]} color={shade(color, -0.22)} roughness={0.1} />
        <Cyl at={[0, h - 0.02, -d * 0.2]} radius={w * 0.12} height={0.04} color={shade(color, -0.4)} segments={16} />
        {/* Foot rests */}
        {[-1, 1].map((s) => (
          <Slab key={s} at={[s * w * 0.32, h - 0.004, 0]} size={[w * 0.2, d * 0.5, 0.012]} color={shade(color, -0.1)} />
        ))}
      </group>
    );
  },

  basin: (p) => {
    const { w, d, h, color, roughness } = p;
    const bowlH = 0.16;
    return (
      <group>
        {/* Pedestal */}
        <Slab at={[0, (h - bowlH) / 2, -d * 0.08]} size={[w * 0.34, d * 0.4, h - bowlH]} color={color} roughness={roughness} />
        <Slab at={[0, h - bowlH / 2, 0]} size={[w, d, bowlH]} color={color} roughness={roughness} />
        <Slab at={[0, h - 0.02, d * 0.04]} size={[w * 0.72, d * 0.62, 0.06]} color={shade(color, -0.16)} roughness={0.1} />
        <Cyl at={[0, h + 0.08, -d * 0.32]} radius={0.014} height={0.16} color="#b9bec4" metalness={0.9} roughness={0.14} />
        <Slab at={[0, h + 0.155, -d * 0.24]} size={[0.026, 0.14, 0.026]} color="#b9bec4" metalness={0.9} roughness={0.14} />
      </group>
    );
  },

  showerTray: (p) => {
    const { w, d, h, color, roughness } = p;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={roughness} />
        <Slab at={[0, h - 0.008, 0]} size={[w - 0.09, d - 0.09, 0.02]} color={shade(color, -0.1)} roughness={0.1} />
        <Cyl at={[0, h - 0.004, 0]} radius={0.045} height={0.012} color="#b9bec4" metalness={0.85} roughness={0.2} segments={18} />
        {/* Glass screen along the back and one side */}
        <Slab at={[0, 0.95, -d / 2 + 0.02]} size={[w, 0.012, 1.9]} color="#cfe0e6" roughness={0.05} metalness={0.1} />
        <Slab at={[-w / 2 + 0.02, 0.95, 0]} size={[0.012, d, 1.9]} color="#cfe0e6" roughness={0.05} metalness={0.1} />
      </group>
    );
  },

  bathtub: (p) => {
    const { w, d, h, color, roughness } = p;
    const wall = 0.06;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={roughness} />
        {/* Hollow interior */}
        <Slab
          at={[0, h - 0.06, 0]}
          size={[w - wall * 2, d - wall * 2, 0.12]}
          color={shade(color, -0.14)}
          roughness={0.1}
        />
        <Cyl at={[-w / 2 + 0.14, h + 0.06, -d * 0.28]} radius={0.015} height={0.12} color="#b9bec4" metalness={0.9} roughness={0.15} />
      </group>
    );
  },

  towelRail: (p) => {
    const { w, d, h, color, metalness } = p;
    return (
      <group>
        {[-1, 1].map((s) => (
          <Slab key={s} at={[s * (w / 2 - 0.02), h / 2, -d / 2 + 0.02]} size={[0.03, 0.04, h]} color={color} metalness={metalness} roughness={0.3} />
        ))}
        {[0.2, 0.45, 0.7, 0.95].map((f, i) => (
          <Cyl
            key={i}
            at={[0, h * f, 0]}
            radius={0.014}
            height={w - 0.04}
            color={color}
            metalness={metalness}
            roughness={0.3}
            rotZ={Math.PI / 2}
            segments={10}
          />
        ))}
      </group>
    );
  },

  // ── Decor / lighting ──────────────────────────────────────────────────
  rug: (p) => {
    const { w, d, h, color } = p;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={0.95} />
        <Slab at={[0, h + 0.001, 0]} size={[w - 0.16, d - 0.16, 0.002]} color={shade(color, 0.07)} roughness={0.95} />
      </group>
    );
  },

  floorLamp: (p) => {
    const { w, h, color, metalness, lightOn = true, lightColor = '#ffe5b4' } = p;
    const shadeH = Math.min(0.3, h * 0.2);
    return (
      <group>
        <Cyl at={[0, 0.015, 0]} radius={w * 0.42} height={0.03} color={color} metalness={metalness} roughness={0.4} segments={20} />
        <Cyl at={[0, h / 2, 0]} radius={0.016} height={h - shadeH} color={color} metalness={metalness} roughness={0.35} segments={10} />
        <Cyl
          at={[0, h - shadeH / 2, 0]}
          radius={w * 0.5}
          radiusTop={w * 0.36}
          height={shadeH}
          color={lightOn ? '#fff8eb' : '#e0dbcf'}
          roughness={0.8}
          segments={22}
        />
        {/* Warm emissive bulb/disc that glows when light is on */}
        <mesh position={[0, h - shadeH + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[w * 0.34, 20]} />
          <meshStandardMaterial
            color={lightOn ? lightColor : '#88847d'}
            emissive={lightOn ? lightColor : '#000000'}
            emissiveIntensity={lightOn ? 1.6 : 0.0}
            roughness={0.2}
          />
        </mesh>
      </group>
    );
  },

  plant: (p) => {
    const { w, h, color } = p;
    const potH = h * 0.3;
    const foliage = '#5d7f52';
    return (
      <group>
        <Cyl at={[0, potH / 2, 0]} radius={w * 0.36} radiusTop={w * 0.44} height={potH} color={color} roughness={0.5} segments={18} />
        <Cyl at={[0, potH + 0.06, 0]} radius={0.02} height={0.14} color="#6b5a44" segments={8} />
        {[
          [0, h * 0.72, 0, 0.34],
          [w * 0.2, h * 0.62, w * 0.12, 0.26],
          [-w * 0.18, h * 0.66, -w * 0.14, 0.28],
          [w * 0.06, h * 0.86, -w * 0.1, 0.22],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow scale={[1, 0.82, 1]}>
            <icosahedronGeometry args={[w * r, 1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? foliage : shade(foliage, 0.07)}
              roughness={0.85}
              flatShading
            />
          </mesh>
        ))}
      </group>
    );
  },

  parasol: (p) => {
    const { w, h, color } = p;
    const canopyH = h * 0.22;
    return (
      <group>
        <Cyl at={[0, 0.03, 0]} radius={w * 0.14} height={0.06} color="#4a4d52" roughness={0.6} segments={18} />
        <Cyl at={[0, h / 2, 0]} radius={0.028} height={h} color="#6b5a44" roughness={0.6} segments={10} />
        <Cyl
          at={[0, h - canopyH / 2, 0]}
          radius={w / 2}
          radiusTop={0.05}
          height={canopyH}
          color={color}
          roughness={0.9}
          segments={12}
        />
      </group>
    );
  },

  mirror: (p) => {
    const { w, d, h, color } = p;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={0.5} metalness={0.3} />
        <Slab at={[0, h / 2, d / 2 + 0.002]} size={[w - 0.06, 0.004, h - 0.06]} color="#d9e3e8" roughness={0.04} metalness={0.92} />
      </group>
    );
  },

  wallArt: (p) => {
    const { w, d, h, color } = p;
    return (
      <group>
        <Slab at={[0, h / 2, 0]} size={[w, d, h]} color={color} roughness={0.6} />
        <Slab at={[0, h / 2, d / 2 + 0.002]} size={[w - 0.07, 0.004, h - 0.07]} color="#e8e4d8" roughness={0.9} />
        <Slab at={[-w * 0.12, h * 0.56, d / 2 + 0.005]} size={[w * 0.4, 0.003, h * 0.34]} color="#8ca08a" roughness={0.9} />
        <Slab at={[w * 0.18, h * 0.36, d / 2 + 0.005]} size={[w * 0.3, 0.003, h * 0.26]} color="#c2a17d" roughness={0.9} />
      </group>
    );
  },

  pendantLamp: (p) => {
    const { w, h, color, metalness, lightOn = true, lightColor = '#ffeaad' } = p;
    const shadeH = Math.min(0.28, h * 0.4);
    const cordH = Math.max(0.1, h - shadeH);
    return (
      <group>
        {/* Ceiling canopy mount */}
        <Cyl at={[0, h - 0.015, 0]} radius={0.06} height={0.03} color={color} metalness={metalness} roughness={0.3} segments={16} />
        {/* Suspension cord / brass rod */}
        <Cyl at={[0, h - cordH / 2, 0]} radius={0.008} height={cordH} color="#2b2d30" metalness={0.7} roughness={0.3} segments={8} />
        {/* Flared shade */}
        <Cyl
          at={[0, shadeH / 2, 0]}
          radius={w * 0.5}
          radiusTop={w * 0.22}
          height={shadeH}
          color={color}
          metalness={metalness}
          roughness={0.35}
          segments={24}
        />
        {/* Glowing bulb fixture inside */}
        <mesh position={[0, shadeH * 0.35, 0]}>
          <sphereGeometry args={[w * 0.14, 16, 16]} />
          <meshStandardMaterial
            color={lightOn ? lightColor : '#66635e'}
            emissive={lightOn ? lightColor : '#000000'}
            emissiveIntensity={lightOn ? 2.0 : 0.0}
            roughness={0.1}
          />
        </mesh>
      </group>
    );
  },

  deskLamp: (p) => {
    const { w, h, color, metalness, lightOn = true, lightColor = '#fff3d6' } = p;
    return (
      <group>
        {/* Weighted round base */}
        <Cyl at={[0, 0.012, 0]} radius={w * 0.38} height={0.024} color={color} metalness={metalness} roughness={0.3} segments={18} />
        {/* Lower stem angled */}
        <mesh position={[0.02, h * 0.26, 0]} rotation={[0, 0, -0.22]}>
          <cylinderGeometry args={[0.01, 0.01, h * 0.5, 10]} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={0.3} />
        </mesh>
        {/* Pivot knuckle */}
        <mesh position={[0.08, h * 0.5, 0]}>
          <sphereGeometry args={[0.022, 10, 10]} />
          <meshStandardMaterial color="#c29b38" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Upper arm */}
        <mesh position={[0.04, h * 0.72, 0]} rotation={[0, 0, 0.32]}>
          <cylinderGeometry args={[0.009, 0.009, h * 0.45, 10]} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={0.3} />
        </mesh>
        {/* Conical shade pointing downward */}
        <group position={[-0.02, h * 0.88, 0]} rotation={[0, 0, 0.5]}>
          <Cyl at={[0, 0, 0]} radius={w * 0.36} radiusTop={w * 0.16} height={h * 0.24} color={color} metalness={metalness} roughness={0.3} segments={18} />
          {/* Bulb inside shade */}
          <mesh position={[0, -0.04, 0]}>
            <sphereGeometry args={[w * 0.11, 14, 14]} />
            <meshStandardMaterial
              color={lightOn ? lightColor : '#5c5a55'}
              emissive={lightOn ? lightColor : '#000000'}
              emissiveIntensity={lightOn ? 1.8 : 0.0}
            />
          </mesh>
        </group>
      </group>
    );
  },

  wallSconce: (p) => {
    const { w, d, h, color, metalness, lightOn = true, lightColor = '#ffddaa' } = p;
    return (
      <group>
        {/* Wall backplate */}
        <Slab at={[0, h / 2, -d * 0.35]} size={[w * 0.7, d * 0.3, h * 0.7]} color={color} metalness={metalness} roughness={0.3} />
        {/* Mounting arm */}
        <Cyl at={[0, h / 2, -d * 0.1]} radius={0.014} height={d * 0.5} color={color} metalness={metalness} roughness={0.3} segments={10} />
        {/* Vertical frosted glass / diffuser tube */}
        <mesh position={[0, h / 2, d * 0.2]}>
          <cylinderGeometry args={[w * 0.35, w * 0.35, h * 0.9, 20]} />
          <meshStandardMaterial
            color={lightOn ? lightColor : '#d1cbbd'}
            emissive={lightOn ? lightColor : '#000000'}
            emissiveIntensity={lightOn ? 1.5 : 0.0}
            roughness={0.2}
            transparent
            opacity={0.92}
          />
        </mesh>
        {/* Metal caps on top and bottom of diffuser */}
        <Cyl at={[0, h * 0.97, d * 0.2]} radius={w * 0.38} height={0.03} color={color} metalness={metalness} roughness={0.3} segments={18} />
        <Cyl at={[0, h * 0.03, d * 0.2]} radius={w * 0.38} height={0.03} color={color} metalness={metalness} roughness={0.3} segments={18} />
      </group>
    );
  },
};

/** Fallback for an unresolved catalog id — deliberately obvious, never a crash. */
export function PlaceholderModel({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.9} wireframe={false} transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w * 1.002, h * 1.002, d * 1.002]} />
        <meshBasicMaterial color="#71717a" wireframe />
      </mesh>
    </group>
  );
}
