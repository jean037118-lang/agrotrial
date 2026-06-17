import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <header style={{ borderBottom: '1px solid #ddd', paddingBottom: '20px', marginBottom: '20px' }}>
        <h1>🌾 AgroTrack CRM</h1>
        <p style={{ color: '#666', margin: '10px 0 0 0' }}>Gerenciamento Agrícola Desktop</p>
      </header>

      <main>
        <section style={{ 
          background: '#f9f9f9', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2>Bem-vindo!</h2>
          <p>Este é seu aplicativo AgroTrack CRM rodando em Tauri.</p>
          <p>Contador: <strong>{count}</strong></p>
          <button 
            onClick={() => setCount(count + 1)}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Incrementar
          </button>
        </section>

        <section>
          <h2>Funcionalidades</h2>
          <ul>
            <li>✅ Desktop com Tauri</li>
            <li>✅ React 19</li>
            <li>✅ Instalador Windows</li>
            <li>🚀 Pronto para expansão</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
