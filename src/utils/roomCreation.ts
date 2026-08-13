import { createProject } from './schema';
import { fromDisplay } from './units';
import type { Project, Unit } from '@/types';

export interface NewRoomOptions {
  name?: string;
  widthFt: number;
  lengthFt: number;
  heightFt?: number;
  unit?: Unit;
}

export function createRoomFromFeet({
  name = 'Untitled room',
  widthFt,
  lengthFt,
  heightFt = 8,
  unit = 'ft',
}: NewRoomOptions): Project {
  const project = createProject(name, unit);

  const widthMetres = fromDisplay(widthFt, 'ft');
  const lengthMetres = fromDisplay(lengthFt, 'ft');
  const heightMetres = fromDisplay(heightFt, 'ft');

  project.room.dimensions.width = widthMetres;
  project.room.dimensions.length = lengthMetres;
  project.room.dimensions.height = heightMetres;

  return project;
}
