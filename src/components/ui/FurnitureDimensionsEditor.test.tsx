import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CatalogItem, FurnitureInstance } from '@/types';
import { FurnitureDimensionsEditor } from './FurnitureDimensionsEditor';

describe('FurnitureDimensionsEditor component', () => {
  const sampleCatalog: CatalogItem = {
    id: 'sofa-test',
    name: 'Sample Test Sofa',
    category: 'living',
    tags: ['sofa'],
    size: { w: 2.0, d: 1.0, h: 0.8 },
    model: 'sofa',
    price: 500,
    finishes: [],
    clearance: { front: 0, back: 0, left: 0, right: 0 },
    elevation: 0,
    wallMounted: false,
    collides: true,
    scaleRange: [0.3, 3.0],
    availability: 'available',
  };

  const sampleInstance: FurnitureInstance = {
    instanceId: 'inst-1',
    catalogId: 'sofa-test',
    position: { x: 0, z: 0 },
    rotation: 0,
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    finishId: 'f1',
    colorOverride: null,
    locked: false,
    visible: true,
    groupId: null,
    note: '',
  };

  it('renders all three dimension fields, unit selector, and sizing mode', () => {
    const handleLiveChange = vi.fn();
    const handleCommit = vi.fn();

    render(
      <FurnitureDimensionsEditor
        instance={sampleInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={handleLiveChange}
        onCommit={handleCommit}
      />
    );

    expect(screen.getByText('Width (W)')).toBeInTheDocument();
    expect(screen.getByText('Depth (D)')).toBeInTheDocument();
    expect(screen.getByText('Height (H)')).toBeInTheDocument();
    expect(screen.getByText('Independent')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('Scale Ratio')).toBeInTheDocument();
  });

  it('resizes width independently without affecting depth and height', () => {
    const handleCommit = vi.fn();

    render(
      <FurnitureDimensionsEditor
        instance={sampleInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={vi.fn()}
        onCommit={handleCommit}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    const widthInput = inputs[0] as HTMLInputElement;

    // Change width from 2.00 to 3.00 (1.5x)
    fireEvent.change(widthInput, { target: { value: '3.00' } });
    fireEvent.blur(widthInput);

    // Only scale.x changes to 1.5; scale.y and scale.z remain 1.0
    expect(handleCommit).toHaveBeenCalledWith(
      { x: 1.5, y: 1.0, z: 1.0 },
      'Resize width'
    );
  });

  it('resizes depth independently without affecting width and height', () => {
    const handleCommit = vi.fn();

    render(
      <FurnitureDimensionsEditor
        instance={sampleInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={vi.fn()}
        onCommit={handleCommit}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    const depthInput = inputs[1] as HTMLInputElement;

    // Change depth from 1.00 to 1.50 (1.5x)
    fireEvent.change(depthInput, { target: { value: '1.50' } });
    fireEvent.blur(depthInput);

    // Only scale.z changes to 1.5; scale.x and scale.y remain 1.0
    expect(handleCommit).toHaveBeenCalledWith(
      { x: 1.0, y: 1.0, z: 1.5 },
      'Resize depth'
    );
  });

  it('resizes height independently without affecting width and depth', () => {
    const handleCommit = vi.fn();

    render(
      <FurnitureDimensionsEditor
        instance={sampleInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={vi.fn()}
        onCommit={handleCommit}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    const heightInput = inputs[2] as HTMLInputElement;

    // Change height from 0.80 to 1.20 (1.5x)
    fireEvent.change(heightInput, { target: { value: '1.20' } });
    fireEvent.blur(heightInput);

    // Only scale.y changes to 1.5; scale.x and scale.z remain 1.0
    expect(handleCommit).toHaveBeenCalledWith(
      { x: 1.0, y: 1.5, z: 1.0 },
      'Resize height'
    );
  });

  it('toggles between metres and feet', () => {
    render(
      <FurnitureDimensionsEditor
        instance={sampleInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={vi.fn()}
        onCommit={vi.fn()}
      />
    );

    const feetBtn = screen.getByRole('button', { name: /ft \(Feet\)/i });
    fireEvent.click(feetBtn);

    // In feet mode, 2m is ~6.56ft
    const inputs = screen.getAllByRole('textbox');
    const widthInput = inputs[0] as HTMLInputElement;
    expect(widthInput.value).toBe('6.56');

    // And secondary badge shows metric equivalent
    expect(screen.getAllByText(/≈ 2.00 m/)[0]).toBeInTheDocument();
  });

  it('switches between Independent and Linked sizing modes', () => {
    render(
      <FurnitureDimensionsEditor
        instance={sampleInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={vi.fn()}
        onCommit={vi.fn()}
      />
    );

    const independentBtn = screen.getByRole('button', { name: 'Independent' });
    const linkedBtn = screen.getByRole('button', { name: 'Linked' });

    // Independent is active by default
    expect(independentBtn.className).toContain('bg-sage-600');

    // Switch to Linked
    fireEvent.click(linkedBtn);
    expect(linkedBtn.className).toContain('bg-sage-600');
  });

  it('applies quick scale preset buttons', () => {
    const handleCommit = vi.fn();

    render(
      <FurnitureDimensionsEditor
        instance={sampleInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={vi.fn()}
        onCommit={handleCommit}
      />
    );

    const preset12 = screen.getByRole('button', { name: '1.2×' });
    fireEvent.click(preset12);

    expect(handleCommit).toHaveBeenCalledWith(
      { x: 1.2, y: 1.2, z: 1.2 },
      'Scale to 120%'
    );
  });

  it('resets to default catalog size when reset is clicked', () => {
    const handleCommit = vi.fn();
    const scaledInstance: FurnitureInstance = {
      ...sampleInstance,
      scale: { x: 1.5, y: 1.5, z: 1.5 },
    };

    render(
      <FurnitureDimensionsEditor
        instance={scaledInstance}
        catalog={sampleCatalog}
        projectUnit="m"
        onLiveChange={vi.fn()}
        onCommit={handleCommit}
      />
    );

    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    fireEvent.click(resetBtn);

    expect(handleCommit).toHaveBeenCalledWith(
      { x: 1, y: 1, z: 1 },
      'Reset furniture size'
    );
  });
});
