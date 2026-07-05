// Tom do Dia — determinístico pela data: todo o Brasil vê o mesmo tom no mesmo dia.
// dom seg ter qua qui sex sáb
const RODIZIO = ['eq', 'eq', 'ac', 'eq', 'ac', 'pa', 'eq']

export const TONS = {
  eq: {
    id: 'eq', nome: 'Equilibrado', emoji: '🌤️',
    strip: '🌤️ TOM DE HOJE: DE BOA. Mas não aperta o 13 que o Contador vira bicho.',
  },
  ac: {
    id: 'ac', nome: 'Ácido', emoji: '🍋',
    strip: '🍋 TOM DE HOJE: ÁCIDO. O Contador tomou limão no café.',
  },
  pa: {
    id: 'pa', nome: 'Pancada', emoji: '🔥',
    strip: '🔥 ALERTA: HOJE O CONTADOR ACORDOU PANCADA. CORAÇÃO FRACO, VOLTE AMANHÃ.',
  },
}

export function tomDoDia(data = new Date(), modoVovo = false) {
  if (modoVovo) return TONS.eq
  return TONS[RODIZIO[data.getDay()]]
}

export function chaveDoDia(data = new Date()) {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
