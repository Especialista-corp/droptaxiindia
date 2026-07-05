import { useEffect, useState } from 'react'

function tempoRestante(expiraEm, agora) {
  const diff = Math.max(0, expiraEm - agora)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return { diff, txt: `${h}h ${String(m).padStart(2, '0')}min` }
}

export default function Carteira({ ctx }) {
  const { carteira, setCarteira, setTela } = ctx
  const [aba, setAba] = useState('vivos')
  const [agora, setAgora] = useState(Date.now())
  const [copiado, setCopiado] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const vivos = carteira.filter((c) => !c.usadoEm && c.expiraEm > agora)
  const usados = carteira.filter((c) => c.usadoEm)
  // Lápides: expirados há menos de 24h — depois disso, descansam em paz
  const lapides = carteira.filter(
    (c) => !c.usadoEm && c.expiraEm <= agora && agora - c.expiraEm < 86400000
  )

  const listas = { vivos, usados, lapides }
  const lista = listas[aba]

  function copiar(c) {
    navigator.clipboard?.writeText(c.codigo)
    setCopiado(c.codigo)
    setTimeout(() => setCopiado(null), 1600)
  }

  function marcarUsado(c) {
    setCarteira((cs) =>
      cs.map((x) => (x.resgatadoEm === c.resgatadoEm && x.id === c.id ? { ...x, usadoEm: Date.now() } : x))
    )
  }

  return (
    <>
      <div className="app-title">👛 Carteira do Patriota</div>

      <div className="abas">
        <button className={aba === 'vivos' ? 'on' : ''} onClick={() => setAba('vivos')}>
          ⏳ Vivos ({vivos.length})
        </button>
        <button className={aba === 'usados' ? 'on' : ''} onClick={() => setAba('usados')}>
          ✅ Usados ({usados.length})
        </button>
        <button className={aba === 'lapides' ? 'on' : ''} onClick={() => setAba('lapides')}>
          🪦 Lápides ({lapides.length})
        </button>
      </div>

      {lista.length === 0 && (
        <div className="card">
          {aba === 'vivos' && (
            <p>
              Carteira vazia. Vá ao Feirão garantir os descontos do dia antes que alguém
              estoque eles como vento.
            </p>
          )}
          {aba === 'usados' && <p>Nenhum cupom usado ainda. O primeiro desconto é inesquecível.</p>}
          {aba === 'lapides' && <p>Nenhum cupom morto. Parabéns: aqui ninguém deixa desconto morrer.</p>}
        </div>
      )}

      {lista.map((c) => {
        const t = tempoRestante(c.expiraEm, agora)
        return (
          <div className={`card cupom ${aba === 'lapides' ? 'morto' : ''}`} key={c.id + c.resgatadoEm}>
            <h3>{c.logoEmoji} {c.sponsor} — {c.titulo}</h3>
            {aba === 'vivos' && <div className="expira">⏳ Morre em {t.txt}. Corre, patriota!</div>}
            {aba === 'lapides' && (
              <p>🪦 Aqui jazem {c.titulo}. Você deixou morrer. O PT agradece a sua indecisão.</p>
            )}
            {aba === 'usados' && <p>✅ Usado. Economia é a alma do livramento.</p>}
            {aba !== 'lapides' && <div className="codigo">{c.codigo}</div>}
            {aba === 'vivos' && (
              <div className="acoes">
                <button onClick={() => copiar(c)}>
                  {copiado === c.codigo ? '✅ Copiado!' : '📋 Copiar código'}
                </button>
                {c.urlResgate && c.canal !== 'loja' && (
                  <a href={c.urlResgate} target="_blank" rel="noreferrer" onClick={() => copiar(c)}>
                    🌐 Usar no site
                  </a>
                )}
                <button onClick={() => marcarUsado(c)}>✔️ Já usei</button>
              </div>
            )}
            <p className="aviso-lgpd" style={{ marginTop: 6 }}>{c.regras}</p>
          </div>
        )
      })}

      <button className="cta" onClick={() => setTela('feirao')}>🛍️ Voltar ao Feirão</button>
    </>
  )
}
