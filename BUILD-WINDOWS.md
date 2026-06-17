# Gerando o instalável (.exe / .msi) do AgroTrial CRM

Este projeto agora tem a integração com [Tauri v2](https://v2.tauri.app/), que
empacota o front-end (Vite + React) numa janela nativa usando o WebView2 do
Windows, gerando um instalador `.exe` (NSIS) e/ou `.msi`.

## 1. Pré-requisitos (uma vez só por máquina)

1. **Node.js** 18+ (você já tem, pois o `npm run dev` funcionou).
2. **Rust** — Tauri compila um binário nativo em Rust.
   - Instale via https://www.rust-lang.org/tools/install (rustup).
   - Depois de instalar, abra um novo terminal e confirme: `rustc --version`.
3. **Microsoft C++ Build Tools** (necessário para compilar o Rust no Windows).
   - Baixe o "Build Tools for Visual Studio" em
     https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Na instalação, marque o componente **"Desktop development with C++"**.
4. **WebView2 Runtime** — geralmente já vem instalado no Windows 10/11. Se não
   tiver, o instalador baixa em https://developer.microsoft.com/microsoft-edge/webview2/

## 2. Instalar dependências do projeto

```
npm install
```

Isso também instala `@tauri-apps/cli`, que já está no `package.json`.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com as credenciais do seu projeto
Supabase (mesma coisa que você já fez para o `npm run dev`).

## 4. Rodar em modo desenvolvimento (janela nativa)

```
npm run tauri:dev
```

Isso abre uma janela do app já apontando para o Vite dev server. Útil para
testar antes de gerar o instalador.

## 5. Gerar o instalador

```
npm run tauri:build
```

A primeira execução pode demorar bastante (compilação do Rust). Ao final, os
instaladores ficam em:

```
src-tauri/target/release/bundle/nsis/AgroTrial CRM_1.0.0_x64-setup.exe
src-tauri/target/release/bundle/msi/AgroTrial CRM_1.0.0_x64_en-US.msi
```

Qualquer um dos dois pode ser distribuído/instalado na sua máquina — o NSIS
(`.exe`) é o mais comum para uso pessoal.

## 6. Ícone do app

Já incluí um ícone provisório em `src-tauri/icons/` (tons de verde/dourado do
tema "Campo & Terra"). Se quiser usar um ícone próprio, gere o conjunto
completo a partir de uma imagem PNG quadrada (1024×1024 recomendado):

```
npx tauri icon caminho/para/seu-icone.png
```

Isso sobrescreve os arquivos em `src-tauri/icons/` automaticamente.

## Observações

- O app continua se conectando ao Supabase normalmente pela internet — o
  Tauri só empacota o front-end, os dados continuam na nuvem.
- O login "Continuar com Google" depende do provedor OAuth do Google estar
  configurado no seu projeto Supabase (Authentication → Providers).
- Se o `npm run tauri:build` falhar na primeira vez por falta de alguma
  ferramenta do Rust/Windows, a mensagem de erro geralmente indica o que
  falta instalar (ex: "link.exe not found" → faltam os C++ Build Tools).
