import { useEffect, useMemo, useState } from 'react'
import { restante, progressoMandato, MODOS, fraseDoModo, ALVOS } from '../engine/countdown.js'
import { sortearFrase } from '../engine/phrases.js'
import { ler, gravar } from '../engine/storage.js'

export default function Home({ ctx }) {
  const { alvoKey, tom, setTela, votoHoje, ofertas, frases, hoje } = ctx
  const [agora, setAgora] = useState(Date.now())
  const [modo, setModo] = useState('classico')

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Frase de abertura: uma por dia, respeitando o Tom do Dia
  const abertura = useMemo(() => {
    const salvo = ler('aberturaDia', null)
    if (salvo && salvo.dia === hoje && salvo.tom === tom.id) return salvo.txt
    const txt = sortearFrase('abertura', frases.abertura, tom.id)
    gravar('aberturaDia', { dia: hoje, tom: tom.id, txt })
    return txt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, tom.id])

  const r = restante(alvoKey, agora)
  const pct = Math.round(progressoMandato(alvoKey, agora) * 100)
  const fraseModo = fraseDoModo(modo, r)
  const listaFeirao = ofertas?.ofertas?.map((o) =>
    `${o.sponsor} ${o.tipo === 'percent' ? o.valor + '%' : o.tipo === 'reais' ? 'R$ ' + o.valor : 'voucher'}`
  ).join(' · ')

  const f2 = (n) => String(n).padStart(2, '0')

  return (
    <>
      <div className="app-title">⬛ Contador do Livramento</div>
      <div className={`tone-strip tone-${tom.id}`}>{tom.strip}</div>
      <div className="card"><p>{abertura}</p></div>

      <div className="faltam">Faltam · {ALVOS[alvoKey].label}</div>
      <div className="digits" role="timer" aria-live="off">
        <div className="cell"><b>{f2(r.dias)}</b><span>dias</span></div>
        <div className="cell"><b>{f2(r.horas)}</b><span>horas</span></div>
        <div className="cell"><b>{f2(r.min)}</b><span>min</span></div>
        <div className="cell"><b>{f2(r.seg)}</b><span>seg</span></div>
      </div>

      <div className="modos">
        {MODOS.map((m) => (
          <button
            key={m.id}
            className={`modo-btn ${modo === m.id ? 'on' : ''}`}
            onClick={() => setModo(m.id)}
          >
            {m.rotulo}
          </button>
        ))}
      </div>
      {fraseModo && <div className="modo-frase">{fraseModo}</div>}

      <div className="thermo"><i style={{ width: pct + '%' }} /></div>
      <div className="thermo-label">
        Termômetro do Livramento: você já sobreviveu a {pct}% do mandato. Aguenta mais um pouco.
      </div>

      {listaFeirao && (
        <button className="card" style={{ textAlign: 'left' }} onClick={() => setTela('feirao')}>
          <h3>🔥 Feirão do dia{ofertas?.patrocinadorMaster ? ` · master: ${ofertas.patrocinadorMaster}` : ''}</h3>
          <p>{listaFeirao}</p>
        </button>
      )}

      {votoHoje === undefined ? (
        <button className="cta tonal" onClick={() => setTela('urna')}>
          🗳️ Votar agora na Urna do Povo
        </button>
      ) : (
        <button className="cta" onClick={() => setTela('feirao')}>
          ✅ Voto do dia computado — ver meus cupons
        </button>
      )}

      <div className="selo">Sátira política · isto não é uma urna oficial</div>
    </>
  )
}
