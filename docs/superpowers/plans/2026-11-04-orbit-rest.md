# ORBIT descanso Implementation Plan

**Goal:** Entregar ORBIT 0.1.5 utilizável com modos, temas e personalização da bola.
**Architecture:** Reutilizar atalhos validados e armazenamento existente, acrescentando categorias de modo e preferências com defaults. Renderizador paginado preserva quatro setores.
**Tech Stack:** Tauri 2, Rust, SQLite, TypeScript, CSS, Playwright existente.
**Spec:** ../../0.1.5-design.md

## Global Constraints
- Preservar identificador app.orbit.launcher, dados e atalhos anteriores.
- 200 ms de balanço, movimento reduzido respeitado, controles >=44 px.
- Nenhuma mudança de configurações de segurança do Windows.

## Review Focus
- Preferências 0.1.4 sem theme/mode devem migrar sem apagar dados.
- Cliques rápidos não podem reverter o modo salvo ou perder tema.
- Mais de quatro opções devem continuar acessíveis sem sobreposição.
- Pasta/exe removido deve falhar sem registrar uso.
- Bordas do monitor, escala 200%, pouca altura e títulos longos devem caber.

## Tasks
- [ ] Acrescentar testes de modos/temas/atalhos na bola e executar antes da implementação.
- [ ] models.rs/persistence.rs/actions.rs: defaults e validação, novas categorias e seis destinos HTTPS. Testar persistência e abrir banco antigo.
- [ ] types.ts/data.ts/bridge.ts: modos, temas, normalização e categorias; manter comandos nativos existentes.
- [ ] radial.ts/settings.ts/main.ts/style.css: setas, páginas, formulário de destino e temas persistidos, animação e foco.
- [ ] window_geometry.rs/tauri.conf.json: 720×440, âncora alinhada com o centro da bola, testes de DPI e bordas.
- [ ] Executar build, Playwright e Rust; revisar capturas; corrigir problemas observados e repetir apenas verificações afetadas.
- [ ] Gerar ZIP portátil, instalador, código-fonte e relatório com limitações verificadas.
