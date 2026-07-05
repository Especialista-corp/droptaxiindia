// Datas-alvo do livramento
export const ALVOS = {
  turno2: { label: '2º turno — 25/10/2026', ts: new Date('2026-10-25T17:00:00-03:00').getTime() },
  posse:  { label: 'Posse — 01/01/2027',    ts: new Date('2027-01-01T15:00:00-03:00').getTime() },
}

// Início do mandato, para o Termômetro do Livramento
const INICIO_MANDATO = new Date('2023-01-01T15:00:00-03:00').getTime()

export function restante(alvoKey, agora = Date.now()) {
  const alvo = ALVOS[alvoKey]?.ts ?? ALVOS.turno2.ts
  const diff = Math.max(0, alvo - agora)
  return {
    total: diff,
    dias: Math.floor(diff / 86400000),
    horas: Math.floor((diff % 86400000) / 3600000),
    min: Math.floor((diff % 3600000) / 60000),
    seg: Math.floor((diff % 60000) / 1000),
    zerou: diff === 0,
  }
}

export function progressoMandato(alvoKey, agora = Date.now()) {
  const alvo = ALVOS[alvoKey]?.ts ?? ALVOS.turno2.ts
  const p = (agora - INICIO_MANDATO) / (alvo - INICIO_MANDATO)
  return Math.min(1, Math.max(0, p))
}

// Modos divertidos do contador
export const MODOS = [
  { id: 'classico',  rotulo: 'Clássico' },
  { id: 'churrasco', rotulo: 'Churrascos' },
  { id: 'cerveja',   rotulo: 'Cervejinhas' },
  { id: 'novela',    rotulo: 'Novela' },
]

export function fraseDoModo(modo, r) {
  switch (modo) {
    case 'churrasco': {
      const fds = Math.max(1, Math.ceil(r.dias / 7))
      return `faltam ${fds} fins de semana de churrasco para o livramento 🍖`
    }
    case 'cerveja': {
      const geladas = r.dias * 2
      return `dá tempo de tomar ${geladas.toLocaleString('pt-BR')} geladas até lá (com moderação, patriota) 🍺`
    }
    case 'novela': {
      const caps = Math.round(r.dias * 6 / 7)
      return `faltam ${caps} capítulos de novela para o último capítulo do PT 📺`
    }
    default:
      return null
  }
}
