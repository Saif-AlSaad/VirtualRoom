import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Grid, SoftShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { useDrag } from '@/store/dragStore';
import { resolveCatalogItem } from '@/data/catalog';
import { evaluatePlacement, indexIssues, worstSeverity } from '@/utils/placement';
import { Room } from './Room';
import { Partitions } from './Partitions';
import { Openings } from './Openings';
import { FurnitureItem } from './FurnitureItem';
import { Lighting } from './Lighting';
import { CameraRig } from './CameraRig';
import { DragController } from './DragController';
import { Bridges } from './Bridges';
import {
  InvalidPlacementLabel,
  RoomDimensions,
  SelectionDimensions,
  SnapGuides,
} from './Guides';
import { MeasureTool } from './MeasureTool';
import { WallHandles } from './WallHandles';

/**
 * The 3D viewport.
 *
 * Everything that reads document state does so through narrow selectors — the
 * scene must not re-render wholesale when a single object moves. The placement
 * evaluation is memoised on the furniture array and room dimensions, and is
 * skipped down to errors-only during an active gesture so a drag stays smooth
 * on a 120-object room.
 */

function SceneContents() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const interacting = useEditor((s) => s.interacting);
  const clearSelection = useEditor((s) => s.clearSelection);
  const dragTargets = useDrag((s) => s.targets);
  const quality = useUI((s) => s.quality);
  const showGrid = useUI((s) => s.showGrid);
  const viewMode = useUI((s) => s.viewMode);
  const presentation = useUI((s) => s.presentationMode);

  const issues = useMemo(
    () => evaluatePlacement(doc, { errorsOnly: interacting }),
    [doc, interacting]
  );
  const issueMap = useMemo(() => indexIssues(issues), [issues]);

  const draggingIds = useMemo(
    () => new Set(dragTargets.map((t) => t.id)),
    [dragTargets]
  );

  const dims = doc.room.dimensions;
  const span = Math.max(dims.width, dims.length);

  return (
    <>
      <Bridges />
      <DragController />
      <CameraRig dims={dims} />
      <Lighting dims={dims} openings={doc.room.openings} />
      {quality === 'high' && <SoftShadows size={26} samples={12} focus={0.8} />}

      {/* Clicking empty space deselects. A large invisible backdrop is more
          reliable than "no hit", which never fires when the pointer is over the
          floor mesh. */}
      <mesh
        position={[0, -0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={() => clearSelection()}
      >
        <planeGeometry args={[span * 12 + 40, span * 12 + 40]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Room room={doc.room} />
      <Partitions />
      <Openings openings={doc.room.openings} dims={dims} />

      {doc.furniture.map((instance) => {
        const catalog = resolveCatalogItem(instance.catalogId);
        return (
          <FurnitureItem
            key={instance.instanceId}
            instance={instance}
            catalog={catalog}
            selected={selection.includes(instance.instanceId)}
            severity={worstSeverity(issueMap.get(instance.instanceId))}
            dragging={draggingIds.has(instance.instanceId)}
          />
        );
      })}

      {/* Grid floor that fades with distance — the standard CAD depth cue. */}
      {showGrid && !presentation && viewMode !== 'walk' && (
        <Grid
          position={[0, 0.004, 0]}
          args={[span * 3, span * 3]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#a3b18a"
          sectionSize={1}
          sectionThickness={0.9}
          sectionColor="#588157"
          fadeDistance={span * 2.6}
          fadeStrength={1.4}
          followCamera={false}
          infiniteGrid={false}
        />
      )}

      {quality !== 'performance' && (
        <ContactShadows
          position={[0, 0.002, 0]}
          scale={span * 1.8}
          resolution={quality === 'high' ? 1024 : 512}
          blur={2.4}
          opacity={0.42}
          far={dims.height}
          // Always live: with a fixed frame count the shadow goes stale the
          // moment furniture moves, which reads as a rendering bug.
          frames={Infinity}
        />
      )}

      {!presentation && (
        <>
          <SnapGuides doc={doc} />
          <RoomDimensions doc={doc} />
          <SelectionDimensions doc={doc} />
          <InvalidPlacementLabel doc={doc} />
          <MeasureTool />
          <WallHandles />
        </>
      )}
    </>
  );
}

export function Scene() {
  const quality = useUI((s) => s.quality);

  return (
    <Canvas
      shadows={quality !== 'performance'}
      dpr={quality === 'high' ? [1, 2] : [1, 1.5]}
      // Required for toDataURL to return pixels rather than a blank image.
      gl={{
        preserveDrawingBuffer: true,
        antialias: quality !== 'performance',
        powerPreference: 'high-performance',
      }}
      camera={{ position: [6, 5, 7], fov: 45, near: 0.1, far: 400 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      style={{ touchAction: 'none' }}
    >
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
    </Canvas>
  );
}
