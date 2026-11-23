import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CheckIn, DataMode, Goal, Habit, HabitEntry } from '@/domain/types.ts';

/**
 * Versão do esquema do IndexedDB. Para migrar, aumente a constante e adicione um
 * bloco `if (oldVersion < N)` em `upgrade` — dados existentes são preservados.
 */
export const SCHEMA_VERSION = 1;

export interface MetadayDB extends DBSchema {
  goals: { key: string; value: Goal };
  habits: { key: string; value: Habit };
  habitEntries: {
    key: string;
    value: HabitEntry;
    indexes: { 'by-habit': string; 'by-date': string };
  };
  checkIns: {
    key: string;
    value: CheckIn;
    indexes: { 'by-goal': string; 'by-date': string };
  };
  /** 'settings' | 'subscription' | 'meta' */
  kv: { key: string; value: unknown };
}

export type MetadayDatabase = IDBPDatabase<MetadayDB>;

/** Bancos separados: dados de demonstração nunca se misturam com dados reais. */
export function dbNameFor(mode: DataMode): string {
  return mode === 'demo' ? 'metaday-demo' : 'metaday-local';
}

export function openMetadayDb(name: string): Promise<MetadayDatabase> {
  return openDB<MetadayDB>(name, SCHEMA_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('goals', { keyPath: 'id' });
        db.createObjectStore('habits', { keyPath: 'id' });
        const entries = db.createObjectStore('habitEntries', { keyPath: 'id' });
        entries.createIndex('by-habit', 'habitId');
        entries.createIndex('by-date', 'localDate');
        const checkIns = db.createObjectStore('checkIns', { keyPath: 'id' });
        checkIns.createIndex('by-goal', 'goalId');
        checkIns.createIndex('by-date', 'localDate');
        db.createObjectStore('kv');
      }
      // if (oldVersion < 2) { ...migração futura... }
    },
  });
}
