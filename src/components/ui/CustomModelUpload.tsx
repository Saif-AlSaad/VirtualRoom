import { useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CatalogItem } from '@/types';
import { registerCustomCatalogItem } from '@/data/catalog';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { Icon } from './Icon';

export function CustomModelUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const addFurniture = useEditor((s) => s.addFurniture);
  const toast = useUI((s) => s.toast);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/\.(glb|gltf)$/i.test(file.name)) {
      toast('Invalid file format', {
        description: 'Please upload a 3D model in .glb or .gltf format.',
        tone: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const loader = new GLTFLoader();

      loader.parse(
        buffer,
        '',
        (gltf) => {
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const rawSize = box.getSize(new THREE.Vector3());

          // Round size to 2 decimal places, with safe minimums
          const w = Math.max(0.15, Math.round(rawSize.x * 100) / 100);
          const d = Math.max(0.15, Math.round(rawSize.z * 100) / 100);
          const h = Math.max(0.15, Math.round(rawSize.y * 100) / 100);

          const customId = `custom-${Date.now()}`;
          const cleanName = file.name.replace(/\.(glb|gltf)$/i, '').replace(/[-_]+/g, ' ');
          const blobUrl = URL.createObjectURL(file);

          const customItem: CatalogItem = {
            id: customId,
            name: cleanName || 'Custom Model',
            category: 'decor',
            tags: ['custom', '3d', 'model', 'imported'],
            size: { w, d, h },
            model: 'coffeeTable',
            price: 0,
            finishes: [
              {
                id: 'original',
                name: 'Original Materials',
                color: '#a3b18a',
                roughness: 0.5,
                metalness: 0.1,
              },
            ],
            clearance: { front: 0, back: 0, left: 0, right: 0 },
            elevation: 0,
            wallMounted: false,
            collides: true,
            scaleRange: [0.2, 5],
            availability: 'custom',
          };

          registerCustomCatalogItem(customItem);
          const placedId = addFurniture(customId, undefined, undefined, blobUrl);

          setLoading(false);
          if (placedId) {
            toast(`Added "${customItem.name}"`, {
              description: `Dimensions: ${w}m × ${d}m × ${h}m`,
              tone: 'success',
            });
          }
        },
        (error) => {
          setLoading(false);
          toast('Failed to parse 3D model', {
            description: error instanceof Error ? error.message : 'Unknown error parsing glTF.',
            tone: 'error',
          });
        }
      );
    } catch (err) {
      setLoading(false);
      toast('Upload failed', {
        description: err instanceof Error ? err.message : 'Could not read file.',
        tone: 'error',
      });
    }

    // Reset input so re-selecting same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="border-t border-ink-200 p-3 dark:border-ink-800">
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-sage-500/60 bg-sage-50/50 px-3 py-2 text-caption font-medium text-sage-800 transition-colors hover:bg-sage-100/60 dark:border-sage-500/40 dark:bg-sage-950/20 dark:text-sage-200 dark:hover:bg-sage-900/40"
      >
        <Icon name={loading ? 'sparkle' : 'upload'} className="h-4 w-4 shrink-0 animate-pulse text-sage-600 dark:text-sage-400" />
        <span>{loading ? 'Processing model…' : 'Import custom 3D model (.glb)'}</span>
      </button>
    </div>
  );
}
