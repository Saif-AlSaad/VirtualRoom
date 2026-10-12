import { useMemo } from 'react';
import * as THREE from 'three';
import type { Opening, RoomDimensions } from '@/types';
import { openingTransform } from '@/utils/roomGeometry';
import { deg2rad } from '@/utils/collision';

/**
 * Architectural joinery for doors and windows.
 *
 * Openings are punched out of the wall by `Room.tsx` / `wallSegments.ts`.
 * This component builds realistic 3D architectural joinery inside the reveals:
 *
 *  - WINDOWS: 4-sided wall reveal lining, interior casing trim, protruding
 *    windowsill board with nosing & horns, under-sill apron, exterior drip edge,
 *    recessed sash frame with dynamic casement mullions & transoms, double-glazed
 *    PBR glass with spacer beads, and a metallic casement latch handle.
 *
 *  - DOORS: 3-sided jamb lining with door stop rebate, interior & exterior architrave
 *    casings, metallic floor threshold, Shaker-style 2-panel solid core door leaf,
 *    dual-sided lever handles with rosettes & keyholes, edge latch bolt, heavy-duty
 *    butt hinges, and an architectural floor clearance swing arc.
 */

// Architectural material colors & finishes
const CASING_WHITE = '#f7f6f2';
const CASING_ROUGHNESS = 0.52;

const REVEAL_WOOD = '#ebe8df';
const SILL_BOARD = '#e2dfd7';
const SILL_DARK = '#484b50';

const GLASS_TINT = '#d4ebf7';
const GLASS_SPACER = '#2f3236';

const HARDWARE_CHROME = '#d8dcde';
const HARDWARE_ROUGHNESS = 0.22;
const HARDWARE_METALNESS = 0.88;

const THRESHOLD_METAL = '#8a8e94';

function WindowUnit({ opening, dims }: { opening: Opening; dims: RoomDimensions }) {
  const { position, rotation } = openingTransform(opening, dims);
  const t = dims.wallThickness;
  const { width: w, height: h, sillHeight: sill } = opening;

  // Reveal lining dimensions
  const jambT = 0.022; // 22 mm reveal board thickness
  const trimW = 0.055; // 55 mm architrave casing width
  const trimD = 0.014; // 14 mm casing projection

  // Inner clear opening inside the lining
  const innerW = Math.max(0.2, w - 2 * jambT);
  const innerH = Math.max(0.2, h - 2 * jambT);

  // Sill board projections
  const sillHorn = 0.04; // Extends 40 mm past opening each side
  const sillNose = 0.055; // Protrudes 55 mm into room (+Z)
  const sillThick = 0.024; // 24 mm thick sill stool
  const sillDepth = t * 0.55 + sillNose;
  const sillCenterZ = (-t * 0.55 + sillNose) / 2;

  // Sash framing & mullion layout
  const hasMullion = w >= 1.1; // Divide into 2 casements if width >= 1.1m
  const hasTransom = h >= 1.35; // Add top transom light if height >= 1.35m

  const sashT = 0.038; // 38 mm sash frame profile thickness
  const sashDepth = 0.042;
  const sashZ = -t * 0.45; // Recessed inside reveal

  const transomH = hasTransom ? Math.max(0.3, innerH * 0.28) : 0;
  const lowerH = hasTransom ? innerH - transomH - sashT : innerH;

  const numCols = hasMullion ? 2 : 1;
  const paneW = (innerW - (numCols - 1) * sashT - 2 * sashT) / numCols;

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, deg2rad(rotation), 0]}>
      {/* ── 1. Wall Reveal Lining (Jambs & Head) ── */}
      {/* Left jamb lining */}
      <mesh position={[-w / 2 + jambT / 2, sill + h / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[jambT, h, t]} />
        <meshStandardMaterial color={REVEAL_WOOD} roughness={CASING_ROUGHNESS} />
      </mesh>
      {/* Right jamb lining */}
      <mesh position={[w / 2 - jambT / 2, sill + h / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[jambT, h, t]} />
        <meshStandardMaterial color={REVEAL_WOOD} roughness={CASING_ROUGHNESS} />
      </mesh>
      {/* Head lining */}
      <mesh position={[0, sill + h - jambT / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[innerW, jambT, t]} />
        <meshStandardMaterial color={REVEAL_WOOD} roughness={CASING_ROUGHNESS} />
      </mesh>
      {/* Reveal stool base lining */}
      <mesh position={[0, sill + jambT / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[innerW, jambT, t]} />
        <meshStandardMaterial color={REVEAL_WOOD} roughness={CASING_ROUGHNESS} />
      </mesh>

      {/* ── 2. Interior Architrave / Casing Trim ── */}
      {/* Left casing */}
      <mesh position={[-w / 2 - trimW / 2 + jambT, sill + h / 2, trimD / 2]} receiveShadow>
        <boxGeometry args={[trimW, h + trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      {/* Right casing */}
      <mesh position={[w / 2 + trimW / 2 - jambT, sill + h / 2, trimD / 2]} receiveShadow>
        <boxGeometry args={[trimW, h + trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      {/* Top casing */}
      <mesh position={[0, sill + h + trimW / 2 - jambT, trimD / 2]} receiveShadow>
        <boxGeometry args={[w + 2 * trimW - 2 * jambT, trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>

      {/* ── 3. Interior Window Sill Board with Bullnose & Apron ── */}
      {/* Protruding windowsill stool board */}
      <mesh position={[0, sill + sillThick / 2, sillCenterZ]} castShadow receiveShadow>
        <boxGeometry args={[w + 2 * sillHorn, sillThick, sillDepth]} />
        <meshStandardMaterial color={SILL_BOARD} roughness={0.42} />
      </mesh>
      {/* Decorative bullnose front edge */}
      <mesh position={[0, sill + sillThick / 2, sillNose]} castShadow>
        <boxGeometry args={[w + 2 * sillHorn + 0.008, sillThick + 0.004, 0.012]} />
        <meshStandardMaterial color={SILL_BOARD} roughness={0.42} />
      </mesh>
      {/* Under-sill apron moulding */}
      <mesh position={[0, sill - 0.02, trimD / 2]} receiveShadow>
        <boxGeometry args={[w + 2 * sillHorn - 0.01, 0.038, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>

      {/* ── 4. Exterior Sub-Sill (Weatherboard / Drip Edge) ── */}
      <mesh position={[0, sill - 0.012, -t - 0.02]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[w + 0.05, 0.026, 0.065]} />
        <meshStandardMaterial color={SILL_DARK} roughness={0.5} metalness={0.2} />
      </mesh>

      {/* ── 5. Window Frame & Glazed Casements ── */}
      {/* Outer fixed window frame border */}
      <group position={[0, sill + h / 2, sashZ]}>
        {/* Frame outer perimeter */}
        <mesh position={[-innerW / 2 + sashT / 2, 0, 0]} castShadow>
          <boxGeometry args={[sashT, innerH, sashDepth]} />
          <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
        </mesh>
        <mesh position={[innerW / 2 - sashT / 2, 0, 0]} castShadow>
          <boxGeometry args={[sashT, innerH, sashDepth]} />
          <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
        </mesh>
        <mesh position={[0, innerH / 2 - sashT / 2, 0]} castShadow>
          <boxGeometry args={[innerW, sashT, sashDepth]} />
          <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
        </mesh>
        <mesh position={[0, -innerH / 2 + sashT / 2, 0]} castShadow>
          <boxGeometry args={[innerW, sashT, sashDepth]} />
          <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
        </mesh>

        {/* Central vertical mullion if multi-pane */}
        {hasMullion && (
          <mesh position={[0, hasTransom ? -transomH / 2 : 0, 0]} castShadow>
            <boxGeometry args={[sashT, hasTransom ? lowerH : innerH, sashDepth * 0.95]} />
            <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
          </mesh>
        )}

        {/* Horizontal transom bar if tall */}
        {hasTransom && (
          <mesh position={[0, innerH / 2 - transomH - sashT / 2, 0]} castShadow>
            <boxGeometry args={[innerW, sashT, sashDepth * 0.95]} />
            <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
          </mesh>
        )}

        {/* Lower Glazing Panes */}
        {Array.from({ length: numCols }).map((_, colIdx) => {
          const colX =
            numCols === 1
              ? 0
              : (colIdx === 0 ? -1 : 1) * (paneW / 2 + sashT / 2);
          const colY = hasTransom ? -innerH / 2 + lowerH / 2 : 0;
          const pH = hasTransom ? lowerH - sashT : innerH - 2 * sashT;

          return (
            <group key={`pane-col-${colIdx}`} position={[colX, colY, 0]}>
              {/* Glass pane with spacer frame */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[paneW, pH, 0.008]} />
                <meshStandardMaterial
                  color={GLASS_TINT}
                  roughness={0.03}
                  metalness={0.12}
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                />
              </mesh>
              {/* Perimeter thermal spacer bead */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[paneW + 0.004, pH + 0.004, 0.006]} />
                <meshStandardMaterial
                  color={GLASS_SPACER}
                  roughness={0.8}
                  wireframe={false}
                  side={THREE.BackSide}
                />
              </mesh>
            </group>
          );
        })}

        {/* Upper Transom Light Glazing Pane if transom active */}
        {hasTransom && (
          <mesh position={[0, innerH / 2 - transomH / 2, 0]}>
            <boxGeometry args={[innerW - 2 * sashT, transomH - sashT, 0.008]} />
            <meshStandardMaterial
              color={GLASS_TINT}
              roughness={0.03}
              metalness={0.12}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* ── 6. Casement Handle Hardware ── */}
        <group
          position={[
            hasMullion ? 0.035 : innerW / 2 - sashT * 1.5,
            hasTransom ? -innerH / 2 + lowerH * 0.48 : 0,
            sashDepth / 2 + 0.004,
          ]}
        >
          {/* Base rosette plate */}
          <mesh castShadow>
            <boxGeometry args={[0.018, 0.048, 0.006]} />
            <meshStandardMaterial
              color={HARDWARE_CHROME}
              roughness={HARDWARE_ROUGHNESS}
              metalness={HARDWARE_METALNESS}
            />
          </mesh>
          {/* Spindle stalk */}
          <mesh position={[0, 0, 0.014]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.02, 10]} />
            <meshStandardMaterial
              color={HARDWARE_CHROME}
              roughness={HARDWARE_ROUGHNESS}
              metalness={HARDWARE_METALNESS}
            />
          </mesh>
          {/* Downward ergonomic lever handle */}
          <mesh position={[0, -0.032, 0.022]} castShadow>
            <boxGeometry args={[0.012, 0.065, 0.008]} />
            <meshStandardMaterial
              color={HARDWARE_CHROME}
              roughness={HARDWARE_ROUGHNESS}
              metalness={HARDWARE_METALNESS}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function DoorUnit({ opening, dims }: { opening: Opening; dims: RoomDimensions }) {
  const { position, rotation } = openingTransform(opening, dims);
  const t = dims.wallThickness;
  const { width: w, height: h } = opening;

  // Jamb lining & casing dimensions
  const jambT = 0.028; // 28 mm solid frame lining
  const trimW = 0.065; // 65 mm architrave casing
  const trimD = 0.016; // 16 mm casing projection

  // Clear opening between jambs
  const innerW = Math.max(0.4, w - 2 * jambT);
  const innerH = Math.max(1.0, h - jambT);

  // Door leaf dimensions (leaves 3mm clearance all round)
  const leafW = innerW - 0.008;
  const leafH = innerH - 0.008;
  const leafThick = 0.04; // Standard 40 mm interior solid core door

  const hingeSign = opening.hinge === 'left' ? -1 : 1;
  const swingSign = opening.swing === 'in' ? 1 : -1;

  // 75° open angle reads unambiguously as an open door and indicates sweep
  const openAngle = deg2rad(75) * swingSign * -hingeSign;

  // Hinge pivot sits at the hinge jamb, recessed against door stop
  const pivotX = hingeSign * (innerW / 2);
  const pivotZ = -0.025; // Flush with interior door stop rebate

  // Quarter-circle floor clearance arc
  const arc = useMemo(() => {
    const steps = 28;
    const hx = pivotX;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * deg2rad(90);
      points.push(
        new THREE.Vector3(
          hx - hingeSign * leafW * Math.cos(a),
          0.004,
          swingSign * leafW * Math.sin(a)
        )
      );
    }
    points.push(new THREE.Vector3(hx, 0.004, 0));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [leafW, pivotX, hingeSign, swingSign]);

  // Shaker panel rail dimensions
  const stileW = 0.11; // 110 mm side stiles
  const topRailH = 0.11;
  const midRailH = 0.13; // Lock rail centered around 0.96m
  const botRailH = 0.18; // Kick rail at bottom

  const topPanelH = leafH * 0.44 - topRailH - midRailH / 2;
  const botPanelH = leafH * 0.56 - botRailH - midRailH / 2;
  const panelW = leafW - 2 * stileW;

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, deg2rad(rotation), 0]}>
      {/* ── 1. Frame / Jamb Lining ── */}
      {/* Left jamb */}
      <mesh position={[-w / 2 + jambT / 2, h / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[jambT, h, t]} />
        <meshStandardMaterial color={REVEAL_WOOD} roughness={CASING_ROUGHNESS} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[w / 2 - jambT / 2, h / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[jambT, h, t]} />
        <meshStandardMaterial color={REVEAL_WOOD} roughness={CASING_ROUGHNESS} />
      </mesh>
      {/* Head header */}
      <mesh position={[0, h - jambT / 2, -t / 2]} receiveShadow>
        <boxGeometry args={[innerW, jambT, t]} />
        <meshStandardMaterial color={REVEAL_WOOD} roughness={CASING_ROUGHNESS} />
      </mesh>

      {/* Door stop rebate strip */}
      <mesh position={[-w / 2 + jambT + 0.006, h / 2, -0.048]} castShadow>
        <boxGeometry args={[0.012, h, 0.024]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      <mesh position={[w / 2 - jambT - 0.006, h / 2, -0.048]} castShadow>
        <boxGeometry args={[0.012, h, 0.024]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      <mesh position={[0, h - jambT - 0.006, -0.048]} castShadow>
        <boxGeometry args={[innerW, 0.012, 0.024]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>

      {/* ── 2. Interior Casing / Architraves ── */}
      <mesh position={[-w / 2 - trimW / 2 + jambT, h / 2, trimD / 2]} receiveShadow>
        <boxGeometry args={[trimW, h + trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      <mesh position={[w / 2 + trimW / 2 - jambT, h / 2, trimD / 2]} receiveShadow>
        <boxGeometry args={[trimW, h + trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      <mesh position={[0, h + trimW / 2 - jambT, trimD / 2]} receiveShadow>
        <boxGeometry args={[w + 2 * trimW - 2 * jambT, trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>

      {/* ── 3. Exterior Casing / Architraves ── */}
      <mesh position={[-w / 2 - trimW / 2 + jambT, h / 2, -t - trimD / 2]} receiveShadow>
        <boxGeometry args={[trimW, h + trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      <mesh position={[w / 2 + trimW / 2 - jambT, h / 2, -t - trimD / 2]} receiveShadow>
        <boxGeometry args={[trimW, h + trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>
      <mesh position={[0, h + trimW / 2 - jambT, -t - trimD / 2]} receiveShadow>
        <boxGeometry args={[w + 2 * trimW - 2 * jambT, trimW, trimD]} />
        <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
      </mesh>

      {/* ── 4. Floor Threshold Bar ── */}
      <mesh position={[0, 0.005, -t / 2]} receiveShadow>
        <boxGeometry args={[innerW + 0.01, 0.01, t + 0.018]} />
        <meshStandardMaterial
          color={THRESHOLD_METAL}
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>

      {/* ── 5. Hinges along Hinge Jamb ── */}
      {[0.22, leafH * 0.5, leafH - 0.22].map((hingeY, idx) => (
        <group key={`hinge-${idx}`} position={[pivotX, hingeY, pivotZ]}>
          {/* Hinge barrel cylinder */}
          <mesh rotation={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.008, 0.008, 0.065, 12]} />
            <meshStandardMaterial
              color={HARDWARE_CHROME}
              roughness={HARDWARE_ROUGHNESS}
              metalness={HARDWARE_METALNESS}
            />
          </mesh>
        </group>
      ))}

      {/* ── 6. Swung Door Leaf & Handles ── */}
      <group position={[pivotX, 0, pivotZ]} rotation={[0, openAngle, 0]}>
        {/* Main Solid Core Slab */}
        <group position={[-hingeSign * (leafW / 2), leafH / 2 + 0.004, 0]}>
          {/* Base leaf body */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[leafW, leafH, leafThick]} />
            <meshStandardMaterial color={CASING_WHITE} roughness={CASING_ROUGHNESS} />
          </mesh>

          {/* Shaker Panel Detail: Recessed Top Panel */}
          <mesh position={[0, leafH * 0.22, 0]} castShadow receiveShadow>
            <boxGeometry args={[panelW, topPanelH, leafThick + 0.004]} />
            <meshStandardMaterial color="#f0eee8" roughness={0.58} />
          </mesh>
          {/* Shaker Panel Detail: Recessed Bottom Panel */}
          <mesh position={[0, -leafH * 0.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[panelW, botPanelH, leafThick + 0.004]} />
            <meshStandardMaterial color="#f0eee8" roughness={0.58} />
          </mesh>

          {/* Edge Latch Bolt Plate */}
          <mesh
            position={[-hingeSign * (leafW / 2 - 0.001), 0.96 - leafH / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.004, 0.065, 0.024]} />
            <meshStandardMaterial
              color={HARDWARE_CHROME}
              roughness={HARDWARE_ROUGHNESS}
              metalness={HARDWARE_METALNESS}
            />
          </mesh>
        </group>

        {/* ── Dual Lever Handles (Interior & Exterior) ── */}
        {[-1, 1].map((faceSide) => {
          const handleX = -hingeSign * (leafW - 0.065);
          const handleY = 0.98;
          const handleZ = faceSide * (leafThick / 2 + 0.003);

          return (
            <group key={`handle-face-${faceSide}`} position={[handleX, handleY, handleZ]}>
              {/* Circular Rosette Escutcheon */}
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.026, 0.026, 0.006, 20]} />
                <meshStandardMaterial
                  color={HARDWARE_CHROME}
                  roughness={HARDWARE_ROUGHNESS}
                  metalness={HARDWARE_METALNESS}
                />
              </mesh>

              {/* Cylindrical Spindle Shank */}
              <mesh
                position={[0, 0, faceSide * 0.016]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.008, 0.008, 0.024, 12]} />
                <meshStandardMaterial
                  color={HARDWARE_CHROME}
                  roughness={HARDWARE_ROUGHNESS}
                  metalness={HARDWARE_METALNESS}
                />
              </mesh>

              {/* Horizontal Ergonomic Lever Handle */}
              <mesh
                position={[hingeSign * 0.05, 0, faceSide * 0.026]}
                castShadow
              >
                <boxGeometry args={[0.115, 0.016, 0.012]} />
                <meshStandardMaterial
                  color={HARDWARE_CHROME}
                  roughness={HARDWARE_ROUGHNESS}
                  metalness={HARDWARE_METALNESS}
                />
              </mesh>

              {/* Lower Privacy Thumbturn Rosette */}
              <mesh
                position={[0, -0.065, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.018, 0.018, 0.005, 16]} />
                <meshStandardMaterial
                  color={HARDWARE_CHROME}
                  roughness={HARDWARE_ROUGHNESS}
                  metalness={HARDWARE_METALNESS}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ── 7. Architectural Floor Swing Clearance Arc ── */}
      <line>
        <primitive object={arc} attach="geometry" />
        <lineBasicMaterial color="#a3b18a" transparent opacity={0.7} />
      </line>
    </group>
  );
}

export function Openings({
  openings,
  dims,
}: {
  openings: Opening[];
  dims: RoomDimensions;
}) {
  return (
    <group name="openings">
      {openings.map((o) =>
        o.kind === 'door' ? (
          <DoorUnit key={o.id} opening={o} dims={dims} />
        ) : (
          <WindowUnit key={o.id} opening={o} dims={dims} />
        )
      )}
    </group>
  );
}
