import { Archive, CalendarX2, CircleCheck, CircleDashed, Hourglass, Minus, Pause, Trophy, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge.tsx';
import { STATUS_LABELS, type GoalDisplayStatus } from '@/domain/progress.ts';

const CONFIG: Record<GoalDisplayStatus, { tone: 'solid' | 'ok' | 'risk' | 'neutral'; icon: ReactNode }> = {
  completed: { tone: 'solid', icon: <Trophy className="size-3.5" aria-hidden /> },
  on_track: { tone: 'ok', icon: <CircleCheck className="size-3.5" aria-hidden /> },
  at_risk: { tone: 'risk', icon: <TriangleAlert className="size-3.5" aria-hidden /> },
  overdue: { tone: 'risk', icon: <CalendarX2 className="size-3.5" aria-hidden /> },
  insufficient: { tone: 'neutral', icon: <Hourglass className="size-3.5" aria-hidden /> },
  no_target: { tone: 'neutral', icon: <Minus className="size-3.5" aria-hidden /> },
  paused: { tone: 'neutral', icon: <Pause className="size-3.5" aria-hidden /> },
  archived: { tone: 'neutral', icon: <Archive className="size-3.5" aria-hidden /> },
};

/** O status nunca depende só da cor: sempre há ícone + texto. */
export function StatusBadge({ status, suspended }: { status: GoalDisplayStatus; suspended?: boolean }) {
  const { tone, icon } = CONFIG[status] ?? { tone: 'neutral' as const, icon: <CircleDashed className="size-3.5" aria-hidden /> };
  return (
    <Badge tone={tone}>
      {icon}
      {suspended ? 'Suspensa pelo plano' : STATUS_LABELS[status]}
    </Badge>
  );
}
