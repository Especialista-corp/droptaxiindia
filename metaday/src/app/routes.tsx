import { Link, Route, Routes } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';
import { EmptyState } from '@/components/ui/page.tsx';
import { BetaStatusPage } from '@/features/beta-status/BetaStatusPage.tsx';
import { CalendarPage } from '@/features/calendar/CalendarPage.tsx';
import { CheckInPage } from '@/features/checkin/CheckInPage.tsx';
import { CountdownPage } from '@/features/countdown/CountdownPage.tsx';
import { GoalDetailPage } from '@/features/goals/GoalDetailPage.tsx';
import { GoalFormPage } from '@/features/goals/GoalFormPage.tsx';
import { GoalsPage } from '@/features/goals/GoalsPage.tsx';
import { HabitFormPage } from '@/features/habits/HabitFormPage.tsx';
import { HabitsPage } from '@/features/habits/HabitsPage.tsx';
import { HomePage } from '@/features/home/HomePage.tsx';
import { AppShell } from '@/features/layout/AppShell.tsx';
import { ReportsPage } from '@/features/reports/ReportsPage.tsx';
import { SettingsPage } from '@/features/settings/SettingsPage.tsx';

function NotFoundPage() {
  return (
    <EmptyState title="Página não encontrada">
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </EmptyState>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="metas" element={<GoalsPage />} />
        <Route path="metas/nova" element={<GoalFormPage />} />
        <Route path="metas/:id" element={<GoalDetailPage />} />
        <Route path="metas/:id/editar" element={<GoalFormPage />} />
        <Route path="checkin" element={<CheckInPage />} />
        <Route path="habitos" element={<HabitsPage />} />
        <Route path="habitos/novo" element={<HabitFormPage />} />
        <Route path="habitos/:id/editar" element={<HabitFormPage />} />
        <Route path="contagem" element={<CountdownPage />} />
        <Route path="calendario" element={<CalendarPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="estado-do-beta" element={<BetaStatusPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
