import { useState } from 'react'
import { sortearFrase } from '../engine/phrases.js'

// Beep de tecla de urna — WebAudio, sem arquivos de som
function beep(freq = 880) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'square'
    o.frequency.value = freq
    g.gain.value = 0.05
    o.connect(g)
    g.connect(ac.destination)
    o.start()
    o.stop(ac.currentTime + 0.09)
  } catch { /* sem áudio, sem drama */ }
}

export default function Urna({ ctx }) {
  const { candidatos, frases, tom, confirmarVoto, votoHoje, setTela } = ctx
  const [sel, setSel] = useState(null)
  const [card13, setCard13] = useState(null)
  const [avisoVoltou, setAvisoVoltou] = useState(null)

  if (votoHoje !== undefined) {
    return (
      <>
        <div className="app-title">🗳️ Urna do Povo</div>
        <div className="card">
          <h3>Voto do dia já computado</h3>
          <p>
            Você já votou hoje (nº {votoHoje}). A urna reabre amanhã — a democracia de
            brincadeira também precisa descansar.
          </p>
        </div>
        <button className="cta" onClick={() => setTela('feirao')}>🛍️ Ir para o Feirão do dia</button>
      </>
    )
  }

  function selecionar(numero) {
    beep(numero === 13 ? 220 : 880)
    setSel(numero)
    setAvisoVoltou(null)
    if (numero === 13) {
      setCard13(sortearFrase('anti13', frases.anti13, tom.id))
    }
  }

  function voltarAtras() {
    setCard13(null)
    setSel(null)
    setAvisoVoltou(sortearFrase('voltou13', frases.voltou13, tom.id))
  }

  return (
    <>
      <div className="app-title">🗳️ Urna do Povo — brincadeira do dia</div>
      <div className={`tone-strip tone-${tom.id}`}>{tom.strip}</div>

      {avisoVoltou && <div className="card"><p>🎉 {avisoVoltou}</p></div>}

      <div className="urna-grid">
        <div className="lado lado-esq">
          <h4>Esquerda</h4>
          <button
            className={`pt-card ${sel === 13 ? 'sel' : ''}`}
            onClick={() => selecionar(13)}
          >
            <span className="pt-flag" aria-hidden="true">{candidatos.esquerda.emoji}</span>
            <span className="num-badge">{candidatos.esquerda.numero}</span>
            <span>{candidatos.esquerda.nome}<br />{candidatos.esquerda.descricao}</span>
          </button>
        </div>
        <div className="lado lado-dir">
          <h4>Direita</h4>
          {candidatos.direita.map((c) => (
            <button
              key={c.numero}
              className={`cand ${sel === c.numero ? 'sel' : ''}`}
              onClick={() => selecionar(c.numero)}
            >
              <span className="av" aria-hidden="true">{c.emoji}</span>
              <span>
                <span className="nm">{c.nome}</span>
                <span className="sg">{c.slogan}</span>
              </span>
              <span className="nb">{c.numero}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`urna-footer uf-${tom.id}`}>{candidatos.rodape[tom.id]}</div>

      <div className="urna-btns">
        <button className="b-corrige" onClick={() => { setSel(null); setCard13(null) }}>Corrige</button>
        <button className="b-confirma" disabled={sel === null} onClick={() => confirmarVoto(sel)}>
          Confirma
        </button>
      </div>

      <div className="selo">Sátira política · isto não é uma urna oficial</div>

      {card13 && (
        <div className="overlay" role="alertdialog" aria-label="Alerta de voto no 13">
          <div className="card13">
            <div className="alert">⚠️ Calma! Ainda dá tempo de voltar atrás.</div>
            <div className="frase">{card13}</div>
            <div className="btns">
              <button className="b-volta" onClick={voltarAtras}>🙏 Voltar e salvar o Brasil</button>
              <button className="b-teima" onClick={() => setCard13(null)}>🤡 Manter o 13 mesmo assim</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
