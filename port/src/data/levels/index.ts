/* Level registry — resolves a level by id for the play route. */

import type { LevelMeta } from "@/types";
import { level1 } from "./level-1";
import { level3 } from "./level-3";

// Ported so far. Add level2, level4…level10 as their content is transcribed.
export const LEVELS: LevelMeta[] = [level1, level3];

export const getLevel = (id: number): LevelMeta | null =>
  LEVELS.find((l) => l.id === id) ?? null;
