import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { normalizeHex, toStrictHex } from '@/utils/color';
import { ColorPicker } from './ColorPicker';

describe('ColorPicker utilities', () => {
  describe('normalizeHex', () => {
    it('normalizes 6-digit hex with hash', () => {
      expect(normalizeHex('#c69c6d')).toBe('#c69c6d');
      expect(normalizeHex('#C69C6D')).toBe('#c69c6d');
    });

    it('normalizes 6-digit hex without hash', () => {
      expect(normalizeHex('c69c6d')).toBe('#c69c6d');
      expect(normalizeHex('1A2B3C')).toBe('#1a2b3c');
    });

    it('expands 3-digit shorthand hex with and without hash', () => {
      expect(normalizeHex('#fff')).toBe('#ffffff');
      expect(normalizeHex('abc')).toBe('#aabbcc');
      expect(normalizeHex('#123')).toBe('#112233');
    });

    it('returns null for invalid strings', () => {
      expect(normalizeHex('')).toBeNull();
      expect(normalizeHex('invalid')).toBeNull();
      expect(normalizeHex('#12345')).toBeNull();
      expect(normalizeHex('#1234567')).toBeNull();
      expect(normalizeHex('xyz123')).toBeNull();
    });
  });

  describe('toStrictHex', () => {
    it('returns valid 7-char lowercase hex or fallback', () => {
      expect(toStrictHex('#A3B18A')).toBe('#a3b18a');
      expect(toStrictHex('dad7cd')).toBe('#dad7cd');
      expect(toStrictHex('bad_value', '#ffffff')).toBe('#ffffff');
    });
  });
});

describe('ColorPicker component', () => {
  const samplePresets = [
    { name: 'Chalk', color: '#f5f4f0' },
    { name: 'Olive', color: '#a3b18a' },
  ];

  it('renders presets and highlights active color', () => {
    const handleChange = vi.fn();
    render(
      <ColorPicker
        label="Wall colour"
        value="#a3b18a"
        presets={samplePresets}
        onChange={handleChange}
      />
    );

    const activeRadio = screen.getByRole('radio', { name: 'Olive' });
    expect(activeRadio).toHaveAttribute('aria-checked', 'true');

    const inactiveRadio = screen.getByRole('radio', { name: 'Chalk' });
    expect(inactiveRadio).toHaveAttribute('aria-checked', 'false');

    // Click another preset
    fireEvent.click(inactiveRadio);
    expect(handleChange).toHaveBeenCalledWith('#f5f4f0');
  });

  it('handles custom hex input edits', () => {
    const handleChange = vi.fn();
    render(
      <ColorPicker
        label="Floor colour"
        value="#c69c6d"
        presets={samplePresets}
        onChange={handleChange}
      />
    );

    const hexInput = screen.getByLabelText('Hex code for Floor colour');
    expect(hexInput).toHaveValue('C69C6D');

    // Type a new valid hex code
    fireEvent.change(hexInput, { target: { value: '3a5a40' } });
    expect(handleChange).toHaveBeenCalledWith('#3a5a40');
  });

  it('reverts on blur if invalid hex was typed', () => {
    const handleChange = vi.fn();
    render(
      <ColorPicker
        label="Wall colour"
        value="#a3b18a"
        presets={samplePresets}
        onChange={handleChange}
      />
    );

    const hexInput = screen.getByLabelText('Hex code for Wall colour');
    fireEvent.change(hexInput, { target: { value: 'invalid' } });
    fireEvent.blur(hexInput);

    // Reverts back to valid current value
    expect(hexInput).toHaveValue('A3B18A');
  });

  it('handles native color picker change', () => {
    const handleChange = vi.fn();
    render(
      <ColorPicker
        label="Floor colour"
        value="#c69c6d"
        presets={samplePresets}
        onChange={handleChange}
      />
    );

    const nativeInput = screen.getByLabelText('Pick custom Floor colour');
    fireEvent.change(nativeInput, { target: { value: '#112233' } });
    expect(handleChange).toHaveBeenCalledWith('#112233');
  });
});
