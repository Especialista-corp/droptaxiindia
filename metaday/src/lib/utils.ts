import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Evita erros de ponto flutuante ao somar/subtrair quantidades (ex.: 0.1 + 0.2). */
export function roundQty(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
