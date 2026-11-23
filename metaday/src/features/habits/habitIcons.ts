import { Apple, Brain, BookOpen, Droplets, Dumbbell, Footprints, Heart, Moon, Pencil, Sun, Target, Wallet, type LucideIcon } from 'lucide-react';
import type { HabitIcon } from '@/domain/types.ts';

export const HABIT_ICON_COMPONENTS: Record<HabitIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  book: BookOpen,
  droplets: Droplets,
  moon: Moon,
  footprints: Footprints,
  brain: Brain,
  apple: Apple,
  pencil: Pencil,
  wallet: Wallet,
  heart: Heart,
  sun: Sun,
  target: Target,
};

export const HABIT_ICON_LABELS: Record<HabitIcon, string> = {
  dumbbell: 'Treino',
  book: 'Leitura',
  droplets: 'Água',
  moon: 'Sono',
  footprints: 'Caminhada',
  brain: 'Estudo',
  apple: 'Alimentação',
  pencil: 'Escrita',
  wallet: 'Finanças',
  heart: 'Saúde',
  sun: 'Rotina matinal',
  target: 'Foco',
};
