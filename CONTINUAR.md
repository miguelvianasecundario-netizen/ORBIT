# Continuar ORBIT 0.1.7

Base: fonte 0.1.5 enviada pelo usuário + correções 0.1.6. Preserve `app.orbit.launcher`, o banco local, os três modos e os quatro temas.

Work é o terceiro menu; só inclui `work-apps`, `work-browser`, `work-projects` e `orbit-work`. `work-all` é uma tela, não uma categoria de atalho. Um atalho Work individual usa `launch_work_item`, e o lote usa `launch_work`, ambos com exclusão mútua no backend.

A extensão Brave deve ser preparada no Orbit e carregada pelo usuário no navegador. O ID vem da chave pública no manifesto e precisa corresponder a `browser_identity.rs`. Não troque a chave sem atualizar ambos. O próprio executável é o host nativo; o ramo de mensagens roda antes de criar Tauri ou registrar atalhos globais.

A lógica de abas e o protocolo foram testados separadamente. O Chromium gerenciado bloqueia instalar a extensão; não alterar a política para contornar isso. Conexão completa com Brave real, registro HKCU, extração de ícones e minimização/foco ainda precisam de validação em Windows. Consulte VALIDACAO.md.

Não substituir a fila de preferências por snapshots otimistas: uma falha de atalho global deve manter o registro anterior sem contaminar os próximos salvamentos. Não recriar o formulário ao salvar o atalho global.

`src/item-icons.ts`: imagem assíncrona com fallback. `automatic_icons.rs`: favicon HTTPS/cache e ícone nativo. `work.rs`: validação, escopo, resultados e histórico. `work_windows.rs`: abertura minimizada, detecção de processo e acompanhamento limitado de janelas novas. `browser_bridge.rs` / `browser_host.rs`: token, framing e registro do host. `browser-extension/`: MV3 e fila de abas. `windows_paths.rs`: caminhos canônicos do Rust para APIs do shell, preservando UNC.

O ZIP não contém banco pessoal. Dados continuam em `%LOCALAPPDATA%\app.orbit.launcher\orbit.sqlite3`. Encerre o aplicativo antes de copiar esse banco.
