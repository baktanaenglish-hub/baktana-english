import type { Unit } from '../types';
import { unit1 } from './units/u01';
import { unit2 } from './units/u02';
import { unit3 } from './units/u03';
import { unit4 } from './units/u04';
import { unit5 } from './units/u05';
import { unit6 } from './units/u06';
import { unit7 } from './units/u07';
import { unit8 } from './units/u08';
import { unit9 } from './units/u09';
import { unit10 } from './units/u10';
import { unit11 } from './units/u11';
import { unit12 } from './units/u12';

/**
 * The course content, one file per unit in ./units (owners in ./units/README.md and
 * docs/spec/v2.md §10). Each lesson lists the words and sentences it teaches; exercises are
 * generated from them (see lib/exercises.ts), so adding content only means adding data.
 *
 * Course order = this list, then each unit's lesson order. Units that have no lessons yet
 * are left out, so a unit file can be merged before its lessons are written.
 * This file is frozen for v2 – nobody edits it during the parallel round.
 */
export const allUnits: Unit[] = [unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9, unit10, unit11, unit12];

export const course: Unit[] = allUnits.filter((unit) => unit.lessons.length > 0);

export const allLessons = course.flatMap((unit) => unit.lessons);

export function findLesson(id: string) {
  for (const unit of course) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return { unit, lesson };
  }
  return undefined;
}
