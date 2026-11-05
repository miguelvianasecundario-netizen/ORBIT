# Continuar ORBIT 0.1.8

Fonte baseada no ZIP 0.1.5 do usuário, correções 0.1.6, Work 0.1.7 e aparência 0.1.8. Preserve a identidade `app.orbit.launcher`, o SQLite e os modos Principal/Descanso/Work.

## Aparência

`Settings` possui `menuTransparency`, `selectionTransparency`, `panelTransparency`, `appTransparency` (inteiros 0–100) e `iconsOnly` (booleano). Padrões: 0, 0, 4, 0 e false. Defaults devem concordar em `src/appearance.ts` e `src-tauri/src/models.rs`. Preferências antigas recebem esses valores via serde/default e normalização web.

Os sliders atualizam fundos imediatamente e agrupam gravações por 250 ms; change/fechar configurações confirma o rascunho. Não recriar o formulário ao ajustar aparência. A fila de preferências usa o último salvamento confirmado; uma falha de atalho global não pode contaminar a próxima alteração.

`radial.ts` desenha uma base SVG com recortes sob os setores existentes. Não adicionar uma camada opaca atrás dos setores, pois isso anularia a transparência independente. Textos/ícones não recebem opacity do contêiner. `icons-only` no elemento raiz altera apenas a apresentação, mantendo IDs, eventos e rótulos acessíveis; configurações e resultados do Work continuam com texto.

## Work

Somente `work-apps`, `work-browser`, `work-projects` e `orbit-work` pertencem ao Work. `work-all` é uma tela. Um clique individual usa `launch_work_item`; o lote usa `launch_work`. Ambos compartilham exclusão mútua no backend.

A extensão Brave exige preparação no Orbit e carregamento pelo usuário no navegador. Sua chave pública define o ID esperado em `browser_identity.rs`. O próprio orbit.exe atende ao native messaging antes de inicializar Tauri. Não alterar as políticas de um navegador gerenciado para contornar bloqueios.

## Validação

80 testes Playwright, 33 Rust e 5 da extensão passaram; build TypeScript/Vite e Clippy Linux/Windows aprovados. Conferir composição, ícones, registro da extensão, foco/minimização e hooks em Windows real. Consulte VALIDACAO.md para os limites.

O ZIP não contém banco pessoal. Dados ficam em `%LOCALAPPDATA%\app.orbit.launcher\orbit.sqlite3`; encerre o Orbit antes de copiar esse banco.
