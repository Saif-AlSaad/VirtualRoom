import { describe, expect, it } from 'vitest';
import { createRoomFromFeet } from './roomCreation';

describe('createRoomFromFeet', () => {
  it('creates a project with feet converted to metres and the display unit set to feet', () => {
    const project = createRoomFromFeet({
      name: 'Studio',
      widthFt: 12,
      lengthFt: 15,
    });

    expect(project.name).toBe('Studio');
    expect(project.unit).toBe('ft');
    expect(project.room.dimensions.width).toBeCloseTo(3.6576, 4);
    expect(project.room.dimensions.length).toBeCloseTo(4.572, 4);
  });
});
