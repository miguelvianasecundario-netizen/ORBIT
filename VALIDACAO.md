# Validação — ORBIT 0.1.5

04/11/2026.

- 50 testes Playwright passaram: modos, quatro temas, persistência, páginas da bola, cadastro de links, layout, contraste, movimento reduzido e animação 200 ms.
- Matriz de interface: 720x440, 620x380, 540x340, 380x264 e 320x480; escalas 100%, 125%, 150% e 200%.
- 23 testes Rust passaram: preferências antigas, novos modos/temas, atalhos de jogos e pastas, revalidação de destinos, SQLite, atalhos globais e geometria de janelas.
- Clippy com -D warnings, TypeScript/Vite e release Tauri/NSIS aprovados.
- Executável 0.1.5 abriu no Windows. O teste nativo confirmou 720x440 DIP, fundo externo transparente, troca de modo e temas salvos no SQLite. A interface real foi observada com os seis streamings e o atalho global reabriu o launcher.
- O seletor nativo de pasta abriu. A automação seguinte foi interrompida porque a política de scripts bloqueou um auxiliar PowerShell. Nenhuma proteção do Windows foi alterada.

Pendente: concluir o fluxo real selecionar/salvar/abrir .exe e pasta na interface; validar monitores físicos com DPI misto; testar instalação/desinstalação em máquina limpa. Testes da prévia e do backend não substituem esses fluxos nativos.

O pacote não é assinado digitalmente. As imagens de temas entregues são capturas da prévia web. A identidade app.orbit.launcher e os dados anteriores foram preservados; há cópia do banco anterior aos testes na pasta work/backup-before-v015 da máquina de origem.
