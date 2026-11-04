# Continuar ORBIT 0.1.6

Fonte baseada no ZIP 0.1.5 enviado pelo usuário. Preserve `app.orbit.launcher`, os modos, os quatro temas, as categorias e os dados locais existentes.

## Estado

59 testes da interface, 23 do núcleo Rust, build TypeScript/Vite e Clippy do núcleo passaram. As correções e limites estão no README e em VALIDACAO.md. A nova fila de preferências aplica cada mudança sobre a última gravação confirmada; não voltar a enfileirar snapshots com alterações que falharam. Não recriar o formulário ao salvar o atalho global.

## Verificações restantes

Executar os fluxos reais de pasta/.exe e hooks no Windows, monitores físicos com DPI misto e instalador NSIS. O teste da fronteira IPC no navegador não substitui esses fluxos. Respeitar a política de execução PowerShell vigente.

## Arquivos principais

`src/main.ts`: estado, fila de preferências, formulário e navegação. `src/style.css`: temas, base do círculo, limites de nomes e layout. `src-tauri/src/window_geometry.rs`: geometria compartilhada, testável também em Linux. `tests/regressions.spec.ts`: casos corrigidos. `tools/visual-preview.mjs`: composições e contraste sem depender de desfoque.

Os ZIPs não contêm o banco pessoal. Ele continua em `%LOCALAPPDATA%\app.orbit.launcher\orbit.sqlite3`. Encerre o aplicativo antes de copiar esse banco; caminhos de arquivos precisam existir na máquina de destino.
