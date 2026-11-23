import { describe, expect, it } from 'vitest';
import { GoalNotActiveError, NotFoundError, ValidationError } from '@/data/errors.ts';
import { goalInput, makeLayer, TODAY } from '../helpers.ts';

describe('check-ins', () => {
  it('registrar atualiza o valor realizado do objetivo; excluir desfaz', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput({ targetValue: 100 }));
    const c1 = await data.checkIns.create({ goalId: g.id, localDate: TODAY, quantity: 5.5, mood: 'good', notes: 'ok' });
    await data.checkIns.create({ goalId: g.id, localDate: '2026-11-22', quantity: 4.5 });
    expect((await data.goals.get(g.id))!.currentValue).toBe(10);
    await data.checkIns.remove(c1.id);
    expect((await data.goals.get(g.id))!.currentValue).toBe(4.5);
    expect(await data.checkIns.list()).toHaveLength(1);
  });

  it('é idempotente por id: reenvio (duplo clique) não duplica nem soma de novo', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput());
    const input = { id: 'client-1', goalId: g.id, localDate: TODAY, quantity: 5 };
    const [a, b] = await Promise.all([data.checkIns.create(input), data.checkIns.create(input)]);
    await data.checkIns.create(input);
    expect(a.id).toBe(b.id);
    expect(await data.checkIns.list()).toHaveLength(1);
    expect((await data.goals.get(g.id))!.currentValue).toBe(5);
  });

  it('corrigir quantidade/data ajusta o valor realizado pela diferença', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput());
    const c = await data.checkIns.create({ goalId: g.id, localDate: TODAY, quantity: 10 });
    const upd = await data.checkIns.update(c.id, { quantity: 7, localDate: '2026-11-21', notes: 'corrigido' });
    expect(upd.quantity).toBe(7);
    expect(upd.localDate).toBe('2026-11-21');
    expect((await data.goals.get(g.id))!.currentValue).toBe(7);
  });

  it('mover o check-in para outro objetivo transfere o valor', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    const b = await data.goals.create(goalInput({ title: 'B' }));
    const c = await data.checkIns.create({ goalId: a.id, localDate: TODAY, quantity: 6 });
    await data.checkIns.update(c.id, { goalId: b.id });
    expect((await data.goals.get(a.id))!.currentValue).toBe(0);
    expect((await data.goals.get(b.id))!.currentValue).toBe(6);
  });

  it('quantidade é opcional (registro de presença)', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput());
    await data.checkIns.create({ goalId: g.id, localDate: TODAY });
    expect((await data.goals.get(g.id))!.currentValue).toBe(0);
    expect(await data.checkIns.list()).toHaveLength(1);
  });

  it('não soma erro de ponto flutuante (0,1 + 0,2)', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput());
    await data.checkIns.create({ goalId: g.id, localDate: TODAY, quantity: 0.1 });
    await data.checkIns.create({ goalId: g.id, localDate: TODAY, quantity: 0.2 });
    expect((await data.goals.get(g.id))!.currentValue).toBe(0.3);
  });

  it('rejeita data futura, quantidade negativa e objetivo inexistente ou inativo', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput());
    await expect(data.checkIns.create({ goalId: g.id, localDate: '2026-11-24' })).rejects.toBeInstanceOf(ValidationError);
    await expect(data.checkIns.create({ goalId: g.id, localDate: TODAY, quantity: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(data.checkIns.create({ goalId: 'nope', localDate: TODAY })).rejects.toBeInstanceOf(NotFoundError);
    await data.goals.setStatus(g.id, 'paused');
    await expect(data.checkIns.create({ goalId: g.id, localDate: TODAY })).rejects.toBeInstanceOf(GoalNotActiveError);
  });

  it('valor realizado pode passar do alvo (sem descartar)', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput({ targetValue: 10 }));
    await data.checkIns.create({ goalId: g.id, localDate: TODAY, quantity: 15 });
    expect((await data.goals.get(g.id))!.currentValue).toBe(15);
  });
});

describe('hábitos', () => {
  const MWF = { type: 'weekly' as const, days: [1, 3, 5] };

  it('registra somente em dias programados e nunca em dias futuros', async () => {
    const data = await makeLayer();
    const h = await data.habits.create({ title: 'Treinar', icon: 'dumbbell', recurrence: MWF, goalIds: [], startDate: '2026-11-01' });
    await data.habits.setEntry(h.id, '2026-11-23', true); // segunda: ok
    await expect(data.habits.setEntry(h.id, '2026-11-24', true)).rejects.toBeInstanceOf(ValidationError); // terça
    await expect(data.habits.setEntry(h.id, '2026-11-25', true)).rejects.toBeInstanceOf(ValidationError); // quarta futura
    expect(await data.habits.listEntries()).toHaveLength(1);
  });

  it('marcar e desmarcar é idempotente', async () => {
    const data = await makeLayer();
    const h = await data.habits.create({ title: 'Treinar', icon: 'dumbbell', recurrence: MWF, goalIds: [], startDate: '2026-11-01' });
    await data.habits.setEntry(h.id, '2026-11-23', true);
    await data.habits.setEntry(h.id, '2026-11-23', true);
    expect(await data.habits.listEntries()).toHaveLength(1);
    await data.habits.setEntry(h.id, '2026-11-23', false);
    await data.habits.setEntry(h.id, '2026-11-23', false);
    expect(await data.habits.listEntries()).toHaveLength(0);
  });

  it('pausar abre um período de pausa; retomar o fecha (sem punir os dias pausados)', async () => {
    const data = await makeLayer();
    const h = await data.habits.create({ title: 'Treinar', icon: 'dumbbell', recurrence: MWF, goalIds: [], startDate: '2026-11-01' });
    const paused = await data.habits.setStatus(h.id, 'paused');
    expect(paused.pauses).toEqual([{ from: TODAY, to: null }]);
    await expect(data.habits.setEntry(h.id, TODAY, true)).rejects.toBeInstanceOf(ValidationError);
    // retomar no mesmo dia remove a pausa vazia
    const resumed = await data.habits.setStatus(h.id, 'active');
    expect(resumed.pauses).toEqual([]);
  });

  it('editar recorrência/título/metas e validar', async () => {
    const data = await makeLayer();
    const g = await data.goals.create(goalInput());
    const h = await data.habits.create({ title: 'Ler', icon: 'book', recurrence: MWF, goalIds: [g.id, 'inexistente'] });
    expect(h.goalIds).toEqual([g.id]); // vínculos inexistentes são descartados
    const upd = await data.habits.update(h.id, { title: 'Ler muito', recurrence: { type: 'weekly', days: [6, 0, 6] } });
    expect(upd.recurrence.days).toEqual([0, 6]);
    await expect(data.habits.update(h.id, { recurrence: { type: 'weekly', days: [] } })).rejects.toBeInstanceOf(ValidationError);
    await expect(data.habits.update(h.id, { title: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('arquivar mantém o histórico; excluir remove registros do hábito', async () => {
    const data = await makeLayer();
    const h = await data.habits.create({ title: 'Treinar', icon: 'dumbbell', recurrence: MWF, goalIds: [], startDate: '2026-11-01' });
    await data.habits.setEntry(h.id, '2026-11-23', true);
    await data.habits.setStatus(h.id, 'archived');
    expect(await data.habits.listEntries()).toHaveLength(1);
    await data.habits.remove(h.id);
    expect(await data.habits.list()).toHaveLength(0);
    expect(await data.habits.listEntries()).toHaveLength(0);
  });
});

describe('configurações', () => {
  it('valida fuso horário e início da semana', async () => {
    const data = await makeLayer();
    await expect(data.settings.update({ timezone: 'Marte/Olympus' })).rejects.toBeInstanceOf(ValidationError);
    const s = await data.settings.update({ weekStartsOn: 1, displayName: ' Ana ' });
    expect(s.weekStartsOn).toBe(1);
    expect(s.displayName).toBe('Ana');
    expect(s.timezone).toBe('America/Sao_Paulo');
  });
});
