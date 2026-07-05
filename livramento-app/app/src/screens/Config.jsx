import { ALVOS } from '../engine/countdown.js'

const SKINS = [
  { id: 'v1', nome: 'Urna Oficial', bg: '#F5F7F4', ac: '#0C5B30' },
  { id: 'v2', nome: 'Placar Neon', bg: '#0B0F0A', ac: '#8DFF6A' },
  { id: 'v3', nome: 'Zap Raiz', bg: '#0E8C3A', ac: '#FFDD00' },
  { id: 'v4', nome: 'Tabloide', bg: '#F1EBDD', ac: '#C21807' },
  { id: 'v5', nome: 'Arquibancada', bg: '#FFD700', ac: '#0B3D2E' },
  { id: 'v6', nome: 'Fintech', bg: '#0F1115', ac: '#35D07F' },
]

export default function Config({ ctx }) {
  const { skin, setSkin, modoVovo, setModoVovo, alvoKey, setAlvoKey } = ctx

  function zerarDados() {
    if (!confirm('Apagar todos os dados do app neste aparelho (votos, cupons, preferências)?')) return
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cdl:'))
      .forEach((k) => localStorage.removeItem(k))
    location.reload()
  }

  return (
    <>
      <div className="app-title">⚙️ Ajustes</div>

      <div className="card">
        <h3>🎨 Skin do app</h3>
        <div className="skin-grid" style={{ marginTop: 8 }}>
          {SKINS.map((s) => (
            <button
              key={s.id}
              className={`skin-opt ${skin === s.id ? 'on' : ''}`}
              onClick={() => setSkin(s.id)}
            >
              <div
                className="amostra"
                style={{ background: `linear-gradient(135deg, ${s.bg} 55%, ${s.ac} 55%)` }}
              />
              {s.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="linha-config">
          <span>👵 Modo Vovó (trava no tom leve, sem pancada)</span>
          <input
            type="checkbox"
            checked={modoVovo}
            onChange={(e) => setModoVovo(e.target.checked)}
          />
        </div>
      </div>

      <div className="card">
        <h3>🎯 Contar até</h3>
        {Object.entries(ALVOS).map(([k, a]) => (
          <div className="linha-config" key={k}>
            <span>{a.label}{k === 'posse' ? ' (para os pessimistas)' : ''}</span>
            <input
              type="radio"
              name="alvo"
              checked={alvoKey === k}
              onChange={() => setAlvoKey(k)}
            />
          </div>
        ))}
      </div>

      <div className="card">
        <h3>🔐 Seus dados</h3>
        <p className="aviso-lgpd">
          Este app não coleta CPF nem envia nada para servidores: votos da brincadeira,
          cupons e preferências ficam gravados só neste aparelho. Limpar os dados do
          navegador apaga tudo.
        </p>
      </div>

      <button className="cta" style={{ background: '#C21807', color: '#fff' }} onClick={zerarDados}>
        🗑️ Zerar meus dados neste aparelho
      </button>

      <div className="selo">Contador do Livramento v0.1 · Sátira política · Não é uma urna oficial</div>
    </>
  )
}
