# Validação — ORBIT 0.1.8

Ambiente: Linux, Node 24, Chromium 155 e Rust. Compilação cruzada para Windows x64 GNU. [Relatório anterior — 0.1.7](docs/validation-v0.1.7.md).

## Resultados

- **80 testes Playwright passaram na execução completa**, incluindo os oito novos cenários de aparência.
- **33 testes Rust passaram**, incluindo migração dos valores antigos, reabertura do banco, limites independentes de transparência e rejeição de valores negativos/fracionários ou acima de 100.
- **5 testes da extensão passaram**. O comportamento da integração Brave permanece o da versão 0.1.7.
- **TypeScript/Vite e Clippy Linux/Windows aprovados**, com `-D warnings`.
- **Release Windows x64 compilado**, com interface e extensão incorporadas. ZIP, versões, arquivos incorporados e SHA-256 conferidos no empacotamento. O executável não foi executado no Windows neste ambiente.

## Casos novos

1. Os quatro fundos recebem alfas independentes, mantendo ícones e textos com opacidade 1.
2. A base SVG possui recortes sob os setores: a transparência da seleção não fica escondida por uma camada opaca atrás.
3. Transparência de 100% remove o preenchimento, preservando nomes e controles.
4. Configurações antigas ganham valores padrão e mantêm tema, modo e atalho global.
5. Trocar tema, transparência e modo só ícones preserva o rascunho do cadastro. As preferências continuam após recarregar.
6. O arraste usa prévia imediata e agrupa gravações; 70 eventos seguidos geram uma gravação. Uma falha do atalho global não contamina o salvamento seguinte.
7. Modo só ícones mantém botões de pelo menos 44×44 e acesso às configurações em 720×440, 620×380, 380×264 e 320×480.
8. Navegação entre Principal/Descanso/Work, paginação, nomes acessíveis e abertura de um link continuam funcionando no modo só ícones. O site desse teste é uma resposta local interceptada pelo navegador.

A suíte anterior também confere tamanhos 540×340 e fatores de rasterização 100%, 125%, 150% e 200%. Esses testes não emulam monitores físicos com DPI misto.

## Revisão visual

Conferidos os quatro temas, com fundos padrão, fundos mais transparentes e o modo só ícones. A imagem em `downloads/orbit-v0.1.8-preview.png` é uma composição no Chromium sobre fundos com texto, com desfoque CSS desligado; não é captura nativa do Windows. A seção de configurações também foi conferida visualmente.

As medições de contraste do script se referem às cores padrão dos temas: mínimo 4,95:1 para texto e 4,71:1 para os símbolos medidos. **Esses valores não garantem contraste sobre qualquer fundo após aumentar a transparência.** O usuário pode voltar aos valores padrão pelo botão Restaurar.

## Limites

A composição transparente real do Windows, ícones nativos, hooks, seletores e monitores físicos não foram executados aqui. Os testes de preferências nativas na interface simulam somente a fronteira IPC; a persistência e validação reais são testadas em Rust/SQLite.

A integração completa com Brave permanece pendente de validação no Windows: a política do Chromium gerenciado bloqueia carregar extensões externas. Na 0.1.7, o host Rust foi testado separadamente por pipes e localhost; veja o relatório anterior. Alguns aplicativos e o Explorador podem ignorar a solicitação de abrir minimizados no Work.

Instalador NSIS e assinatura digital não foram gerados. O download desta entrega é portátil.
