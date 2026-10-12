import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from './editorStore';
import { CATALOG } from '@/data/catalog';
import { createProject } from '@/utils/schema';
import { evaluatePlacement } from '@/utils/placement';

const SOFA = 'sofa-3';
const CHAIR = 'dining-chair';

function reset() {
  useEditor.getState().loadProject(createProject('Test', 'm'));
  useEditor.getState().setRoomDimensions({ width: 6, length: 8 });
  // setRoomDimensions pushes a history entry; start each test from a clean slate.
  useEditor.setState({ past: [], future: [], revision: 0, lastSavedRevision: 0 });
}

describe('undo / redo', () => {
  beforeEach(reset);

  it('restores the previous document and reports the operation label', () => {
    useEditor.getState().addFurniture(SOFA);
    expect(useEditor.getState().doc.furniture).toHaveLength(1);

    const label = useEditor.getState().undo();
    expect(label).toMatch(/add/i);
    expect(useEditor.getState().doc.furniture).toHaveLength(0);
  });

  it('redoes what was undone', () => {
    useEditor.getState().addFurniture(SOFA);
    useEditor.getState().undo();
    useEditor.getState().redo();
    expect(useEditor.getState().doc.furniture).toHaveLength(1);
  });

  it('clears the redo stack once a new edit is made', () => {
    useEditor.getState().addFurniture(SOFA);
    useEditor.getState().undo();
    expect(useEditor.getState().canRedo()).toBe(true);

    useEditor.getState().addFurniture(CHAIR);
    expect(useEditor.getState().canRedo()).toBe(false);
  });

  it('is a no-op when there is nothing to undo', () => {
    expect(useEditor.getState().undo()).toBeNull();
    expect(useEditor.getState().redo()).toBeNull();
  });

  it('drops selection entries for objects that no longer exist after undo', () => {
    const id = useEditor.getState().addFurniture(SOFA);
    expect(useEditor.getState().selection).toEqual([id]);
    useEditor.getState().undo();
    expect(useEditor.getState().selection).toEqual([]);
  });

  it('survives a long run of edits without corrupting state', () => {
    for (let i = 0; i < 12; i++) useEditor.getState().addFurniture(CHAIR);
    expect(useEditor.getState().doc.furniture).toHaveLength(12);
    for (let i = 0; i < 12; i++) useEditor.getState().undo();
    expect(useEditor.getState().doc.furniture).toHaveLength(0);
    for (let i = 0; i < 12; i++) useEditor.getState().redo();
    expect(useEditor.getState().doc.furniture).toHaveLength(12);
  });
});

describe('gestures produce one history entry', () => {
  beforeEach(reset);

  it('collapses many live mutations into a single undo step', () => {
    const id = useEditor.getState().addFurniture(SOFA)!;
    const before = useEditor.getState().past.length;

    useEditor.getState().beginGesture('Move item');
    for (let i = 0; i < 30; i++) {
      useEditor.getState().mutateLive((d) => {
        const f = d.furniture.find((x) => x.instanceId === id)!;
        f.position.x = i * 0.05;
      });
    }
    useEditor.getState().endGesture();

    expect(useEditor.getState().past.length).toBe(before + 1);

    useEditor.getState().undo();
    const restored = useEditor
      .getState()
      .doc.furniture.find((f) => f.instanceId === id)!;
    expect(restored.position.x).toBeCloseTo(0);
  });

  it('does not record a gesture that changed nothing', () => {
    useEditor.getState().addFurniture(SOFA);
    const before = useEditor.getState().past.length;
    useEditor.getState().beginGesture('Move item');
    useEditor.getState().endGesture();
    expect(useEditor.getState().past.length).toBe(before);
  });

  it('cancelGesture rolls back to the pre-gesture document', () => {
    const id = useEditor.getState().addFurniture(SOFA)!;
    useEditor.getState().beginGesture('Move item');
    useEditor.getState().mutateLive((d) => {
      d.furniture.find((x) => x.instanceId === id)!.position.x = 2.5;
    });
    useEditor.getState().cancelGesture();
    expect(
      useEditor.getState().doc.furniture.find((f) => f.instanceId === id)!.position.x
    ).toBeCloseTo(0);
  });
});

describe('placement invariants', () => {
  beforeEach(reset);

  it('never leaves a newly added item outside the room', () => {
    useEditor.getState().addFurniture(SOFA, { x: 99, z: 99 });
    const issues = evaluatePlacement(useEditor.getState().doc);
    expect(issues.filter((i) => i.code === 'out-of-bounds')).toHaveLength(0);
  });

  it('finds a free spot instead of stacking identical items', () => {
    useEditor.getState().addFurniture(SOFA);
    useEditor.getState().addFurniture(SOFA);
    useEditor.getState().addFurniture(SOFA);

    const overlaps = evaluatePlacement(useEditor.getState().doc).filter(
      (i) => i.code === 'overlap'
    );
    expect(overlaps).toHaveLength(0);
  });

  it('clamps furniture back inside when the room is shrunk', () => {
    useEditor.getState().addFurniture(SOFA, { x: 2.4, z: 3.4 });
    useEditor.getState().setRoomDimensions({ width: 3, length: 3 });

    const issues = evaluatePlacement(useEditor.getState().doc).filter(
      (i) => i.code === 'out-of-bounds'
    );
    expect(issues).toHaveLength(0);
  });

  it('keeps openings on their wall when the room is shrunk', () => {
    useEditor.getState().addOpening('door', 'north');
    useEditor.getState().updateOpening(
      useEditor.getState().doc.room.openings[0].id,
      { offset: 5.5 }
    );
    useEditor.getState().setRoomDimensions({ width: 2 });

    const opening = useEditor.getState().doc.room.openings[0];
    expect(opening.offset + opening.width / 2).toBeLessThanOrEqual(2 + 1e-6);
    expect(opening.offset - opening.width / 2).toBeGreaterThanOrEqual(-1e-6);
  });

  it('refuses to move or delete a locked item', () => {
    const id = useEditor.getState().addFurniture(SOFA)!;
    useEditor.getState().setLocked([id], true);
    const before = { ...useEditor.getState().doc.furniture[0].position };

    useEditor.getState().moveSelection({ x: 1, z: 1 });
    expect(useEditor.getState().doc.furniture[0].position).toEqual(before);

    useEditor.getState().deleteSelection();
    expect(useEditor.getState().doc.furniture).toHaveLength(1);
  });

  it('clamps scale to the catalog range', () => {
    const id = useEditor.getState().addFurniture(SOFA)!;
    useEditor.getState().updateFurniture(id, { scale: { x: 99, y: 99, z: 99 } });
    const [, max] = CATALOG.find((c) => c.id === SOFA)!.scaleRange;
    expect(useEditor.getState().doc.furniture[0].scale.x).toBeCloseTo(max);
  });

  it('normalises rotation into [0, 360)', () => {
    const id = useEditor.getState().addFurniture(SOFA)!;
    useEditor.getState().updateFurniture(id, { rotation: -90 });
    expect(useEditor.getState().doc.furniture[0].rotation).toBe(270);
  });
});

describe('duplicate', () => {
  beforeEach(reset);

  it('creates a new instance id and does not overlap the original', () => {
    const id = useEditor.getState().addFurniture(SOFA)!;
    const [copyId] = useEditor.getState().duplicateSelection();

    expect(copyId).toBeDefined();
    expect(copyId).not.toBe(id);
    expect(useEditor.getState().doc.furniture).toHaveLength(2);

    const overlaps = evaluatePlacement(useEditor.getState().doc).filter(
      (i) => i.code === 'overlap'
    );
    expect(overlaps).toHaveLength(0);
  });

  it('selects the copy, not the original', () => {
    useEditor.getState().addFurniture(SOFA);
    const [copyId] = useEditor.getState().duplicateSelection();
    expect(useEditor.getState().selection).toEqual([copyId]);
  });
});

describe('save bookkeeping', () => {
  beforeEach(reset);

  it('marks the document dirty on edit and clean after a matching save', () => {
    useEditor.getState().addFurniture(SOFA);
    const state = useEditor.getState();
    expect(state.revision).not.toBe(state.lastSavedRevision);
    expect(state.saveStatus).toBe('saving');

    state.markSaved(state.revision);
    expect(useEditor.getState().saveStatus).toBe('saved');
  });

  it('stays dirty when the document changed while the save was in flight', () => {
    useEditor.getState().addFurniture(SOFA);
    const inFlight = useEditor.getState().revision;
    useEditor.getState().addFurniture(CHAIR);

    useEditor.getState().markSaved(inFlight);
    expect(useEditor.getState().saveStatus).toBe('saving');
  });
});

describe('alignment and elevation', () => {
  beforeEach(reset);

  it('aligns selected furniture and can be undone', () => {
    const id1 = useEditor.getState().addFurniture(CHAIR, { x: -1, z: 0 });
    const id2 = useEditor.getState().addFurniture(CHAIR, { x: 2, z: 0 });
    useEditor.getState().selectMany([id1!, id2!]);

    useEditor.getState().alignSelection('left');
    const f1 = useEditor.getState().doc.furniture.find((f) => f.instanceId === id1);
    const f2 = useEditor.getState().doc.furniture.find((f) => f.instanceId === id2);

    expect(f1!.position.x).toBeCloseTo(f2!.position.x);

    // Undo restores previous position
    useEditor.getState().undo();
    const f2Prev = useEditor.getState().doc.furniture.find((f) => f.instanceId === id2);
    expect(f2Prev!.position.x).toBeCloseTo(2);
  });

  it('updates elevation and can be undone', () => {
    const id = useEditor.getState().addFurniture(SOFA);
    useEditor.getState().updateFurniture(id!, { elevation: 0.75 });

    let sofa = useEditor.getState().doc.furniture.find((f) => f.instanceId === id);
    expect(sofa!.elevation).toBe(0.75);

    useEditor.getState().undo();
    sofa = useEditor.getState().doc.furniture.find((f) => f.instanceId === id);
    expect(sofa!.elevation).toBeUndefined();
  });
});

describe('interior partition walls and lighting', () => {
  beforeEach(reset);

  it('adds, updates, duplicates, and deletes a partition wall with undo/redo', () => {
    const id = useEditor.getState().addPartition('half');
    expect(id).toBeDefined();

    const partitions = useEditor.getState().doc.room.partitions ?? [];
    expect(partitions).toHaveLength(1);
    expect(partitions[0].height).toBe(1.1);

    // Update length
    useEditor.getState().updatePartition(id, { length: 3.2 });
    expect(useEditor.getState().doc.room.partitions?.[0].length).toBe(3.2);

    // Duplicate
    const dupId = useEditor.getState().duplicatePartition(id);
    expect(dupId).toBeDefined();
    expect(useEditor.getState().doc.room.partitions).toHaveLength(2);

    // Undo duplicate
    useEditor.getState().undo();
    expect(useEditor.getState().doc.room.partitions).toHaveLength(1);

    // Delete
    useEditor.getState().removePartition(id);
    expect(useEditor.getState().doc.room.partitions).toHaveLength(0);

    // Undo delete
    useEditor.getState().undo();
    expect(useEditor.getState().doc.room.partitions).toHaveLength(1);
  });

  it('updates furniture lighting and supports undo', () => {
    const id = useEditor.getState().addFurniture('floor-lamp', { x: 0, z: 0 });
    expect(id).toBeDefined();

    useEditor.getState().updateFurnitureLight(id!, {
      lightEnabled: false,
      lightIntensity: 2.5,
      lightColor: '#ffddaa',
    });

    let f = useEditor.getState().doc.furniture.find((x) => x.instanceId === id);
    expect(f?.lightEnabled).toBe(false);
    expect(f?.lightIntensity).toBe(2.5);
    expect(f?.lightColor).toBe('#ffddaa');

    useEditor.getState().undo();
    f = useEditor.getState().doc.furniture.find((x) => x.instanceId === id);
    expect(f?.lightEnabled).toBeUndefined();
  });

  it('customizes a specific wall with per-wall color and pattern overrides with undo/redo', () => {
    // Customize North wall color
    useEditor.getState().setWallSideColor('north', '#2b3a4a');
    expect(useEditor.getState().doc.room.wallOverrides?.north?.color).toBe('#2b3a4a');
    expect(useEditor.getState().doc.room.walls.color).not.toBe('#2b3a4a');

    // Customize North wall pattern
    useEditor.getState().setWallSidePattern('north', 'brick');
    expect(useEditor.getState().doc.room.wallOverrides?.north?.pattern).toBe('brick');

    // Reset North wall to default
    useEditor.getState().resetWallSide('north');
    expect(useEditor.getState().doc.room.wallOverrides?.north).toBeUndefined();

    // Undo reset
    useEditor.getState().undo();
    expect(useEditor.getState().doc.room.wallOverrides?.north?.pattern).toBe('brick');
    expect(useEditor.getState().doc.room.wallOverrides?.north?.color).toBe('#2b3a4a');

    // Setting all walls updates base walls
    useEditor.getState().setWallSideColor('all', '#ffffff');
    expect(useEditor.getState().doc.room.walls.color).toBe('#ffffff');
  });

  it('customizes floor color and pattern independently with undo/redo', () => {
    const initialColor = useEditor.getState().doc.room.floor.color;
    const initialPattern = useEditor.getState().doc.room.floor.pattern;

    // Customize floor with arbitrary custom color
    useEditor.getState().setFloor({ color: '#2a3b4c' });
    expect(useEditor.getState().doc.room.floor.color).toBe('#2a3b4c');
    expect(useEditor.getState().doc.room.floor.pattern).toBe(initialPattern);

    // Customize floor pattern
    useEditor.getState().setFloor({ pattern: 'herringbone' });
    expect(useEditor.getState().doc.room.floor.color).toBe('#2a3b4c');
    expect(useEditor.getState().doc.room.floor.pattern).toBe('herringbone');

    // Undo pattern change
    useEditor.getState().undo();
    expect(useEditor.getState().doc.room.floor.pattern).toBe(initialPattern);
    expect(useEditor.getState().doc.room.floor.color).toBe('#2a3b4c');

    // Undo color change
    useEditor.getState().undo();
    expect(useEditor.getState().doc.room.floor.color).toBe(initialColor);

    // Redo color change
    useEditor.getState().redo();
    expect(useEditor.getState().doc.room.floor.color).toBe('#2a3b4c');
  });
});


