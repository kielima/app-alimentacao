import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Ponte do Web Share Target (Android): o share_target do manifest aponta para o
// path real /receitas/importar?url=…, mas o app usa HashRouter. Se abrirmos num
// path com query de compartilhamento, convertemos para a rota de hash antes de
// montar o React, preservando os parâmetros (url/text/title).
(function bridgeShareTarget() {
  const { pathname, search, hash } = window.location;
  if (hash || !search) return;
  const params = new URLSearchParams(search);
  const isShare = params.has('url') || params.has('text') || params.has('title');
  if (pathname.replace(/\/+$/, '').endsWith('/receitas/importar') || isShare) {
    window.history.replaceState(null, '', `/#/receitas/importar${search}`);
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
