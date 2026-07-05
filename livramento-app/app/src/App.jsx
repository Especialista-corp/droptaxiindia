import { useEffect, useMemo, useState } from 'react'
import candidatos from './content/candidatos.json'
import frases from './content/frases.json'
import { tomDoDia, chaveDoDia } from './engine/tone.js'
import { ler, gravar } from './engine/storage.js'
import { sortearFrase } from './engine/phrases.js'
import Home from './screens/Home.jsx'
import Urna from './screens/Urna.jsx'
import Resultado from './screens/Resultado.jsx'
import Feirao from './screens/Feirao.jsx'
import Carteira from './screens/Carteira.jsx'
import Config from './screens/Config.jsx'

const TELAS = [
  { id: 'home', rotulo: 'Início', ic: '⏳' },
  { id: 'urna', rotulo: 'Urna', ic: '🗳️' },
  { id: 'feirao', rotulo: 'Feirão', ic: '🛍️' },
  { id: 'carteira', rotulo: 'Carteira', ic: '👛' },
  { id: 'config', rotulo: 'Ajustes', ic: '⚙️' },
]

export default function App() {
  const [tela, setTela] = useState('home')
  const [skin, setSkin] = useState(() => ler('skin', 'v1'))
  const [modoVovo, setModoVovo] = useState(() => ler('modoVovo', false))
  const [alvoKey, setAlvoKey] = useState(() => ler('alvo', 'turno2'))
  const [votos, setVotos] = useState(() => ler('votos', {}))
  const [carteira, setCarteira] = useState(() => ler('carteira', []))
  const [resultado, setResultado] = useState(null)
  const [ofertas, setOfertas] = useState(null)

  const hoje = chaveDoDia()
  const tom = tomDoDia(new Date(), modoVovo)
  const votoHoje = votos[hoje]

  useEffect(() => { document.documentElement.dataset.skin = skin; gravar('skin', skin) }, [skin])
  useEffect(() => { document.documentElement.dataset.tom = tom.id }, [tom.id])
  useEffect(() => { gravar('modoVovo', modoVovo) }, [modoVovo])
  useEffect(() => { gravar('alvo', alvoKey) }, [alvoKey])
  useEffect(() => { gravar('votos', votos) }, [votos])
  useEffect(() => { gravar('carteira', carteira) }, [carteira])

  // Ofertas do dia: JSON estático — troca diária sem backend e sem atualizar o app.
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'ofertas.json')
      .then((r) => r.json())
      .then(setOfertas)
      .catch(() => setOfertas({ ofertas: [], maxEscolhasPorDia: 3, validadeMaxHoras: 48 }))
  }, [])

  const streak = useMemo(() => {
    let n = 0
    const d = new Date()
    for (;;) {
      const k = chaveDoDia(d)
      if (votos[k] === undefined) break
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  }, [votos])

  function ultimoVotoAnterior() {
    const chaves = Object.keys(votos).filter((k) => k !== hoje).sort()
    return chaves.length ? votos[chaves[chaves.length - 1]] : undefined
  }

  function confirmarVoto(numero) {
    const anterior = ultimoVotoAnterior()
    setVotos((v) => ({ ...v, [hoje]: numero }))
    if (numero === 13) {
      setResultado({ tipo: '13', frase: sortearFrase('confirmou13', frases.confirmou13, tom.id) })
    } else {
      const fraseParabens = sortearFrase('parabens', frases.parabens, tom.id)
      let fraseFidelidade = null
      if (anterior !== undefined) {
        fraseFidelidade = anterior === numero
          ? sortearFrase('fidelidade', frases.fidelidade, tom.id)
          : sortearFrase('mudouParaDireita', frases.mudouParaDireita, tom.id)
      }
      setResultado({ tipo: 'direita', numero, fraseParabens, fraseFidelidade })
    }
    setTela('resultado')
  }

  function resgatar(oferta) {
    const agora = Date.now()
    const horas = ofertas?.validadeMaxHoras ?? 48
    setCarteira((c) => [
      ...c,
      { ...oferta, resgatadoEm: agora, expiraEm: agora + horas * 3600000, usadoEm: null, dia: hoje },
    ])
  }

  const ctx = {
    tela, setTela, skin, setSkin, modoVovo, setModoVovo, alvoKey, setAlvoKey,
    votos, votoHoje, streak, tom, hoje, candidatos, frases, confirmarVoto,
    ofertas, carteira, setCarteira, resgatar, resultado,
  }

  return (
    <>
      <div className="shell">
        {tela === 'home' && <Home ctx={ctx} />}
        {tela === 'urna' && <Urna ctx={ctx} />}
        {tela === 'resultado' && <Resultado ctx={ctx} />}
        {tela === 'feirao' && <Feirao ctx={ctx} />}
        {tela === 'carteira' && <Carteira ctx={ctx} />}
        {tela === 'config' && <Config ctx={ctx} />}
      </div>
      <nav className="nav" aria-label="Navegação principal">
        {TELAS.map((t) => (
          <button key={t.id} className={tela === t.id ? 'on' : ''} onClick={() => setTela(t.id)}>
            <span className="ic" aria-hidden="true">{t.ic}</span>
            {t.rotulo}
          </button>
        ))}
      </nav>
    </>
  )
}
