import { createIdbDataLayer } from '@/data/idb/createIdbDataLayer.ts';
import type { DataLayer } from '@/data/repositories.ts';
import type { DataMode, GoalInput } from '@/domain/types.ts';

export const TEST_TZ = 'America/Sao_Paulo';
/** 2026-11-23 12:00 em São Paulo. */
export const TEST_NOW = new Date('2026-11-23T15:00:00.000Z');
export const TODAY = '2026-11-23';

let counter = 0;
export const uniqueDbName = () => `metaday-test-${Date.now()}-${++counter}`;

export async function makeLayer(
  opts: { dbName?: string; mode?: DataMode; now?: () => Date } = {},
): Promise<DataLayer> {
  const layer = await createIdbDataLayer({
    dbName: opts.dbName ?? uniqueDbName(),
    mode: opts.mode ?? 'local',
    now: opts.now ?? (() => TEST_NOW),
  });
  await layer.settings.update({ timezone: TEST_TZ });
  return layer;
}

export function goalInput(over: Partial<GoalInput> = {}): GoalInput {
  return {
    title: 'Meta',
    startDate: '2026-11-01',
    targetDate: '2026-12-31',
    targetValue: 100,
    unit: 'km',
    frequency: 'weekly',
    priority: 'medium',
    ...over,
  };
}
