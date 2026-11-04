# Validação — ORBIT 0.1.6

Base recebida: `orbit-codigo-fonte-v0.1.5.zip`. Ambiente desta rodada: Linux, Node 24, Chromium e Rust. O relatório anterior recebido está em [docs/validation-v0.1.5-received.md](docs/validation-v0.1.5-received.md); seus testes Windows não foram repetidos aqui.

## Resultado

- **59 testes Playwright passaram.** Os 50 existentes passaram antes das alterações. Sete novos casos falharam na fonte recebida e passaram após as correções; mais dois cobrem o botão de Streaming e o limite Unicode.
- **23 testes Rust passaram**, incluindo os sete de geometria que antes eram compilados apenas no Windows. Nenhuma preferência ou tabela foi migrada de forma destrutiva.
- **TypeScript/Vite e Clippy do núcleo aprovados**, com `-D warnings`.
- **Executável Windows x64 compilado em release** com alvo GNU, `custom-protocol` e a interface final incorporada. `orbit.exe` e `WebView2Loader.dll` são PE x86-64. O binário 0.1.6 não foi executado neste ambiente Linux.
- Após o acabamento final do círculo e cores, **21 testes afetados foram repetidos e passaram**; o restante da suíte não sofreu alterações funcionais.
- Layouts: 720×440, 620×380, 540×340, 380×264 e 320×480; escalas de rasterização 100%, 125%, 150% e 200%. Isso não emula monitores físicos com DPI misto.
- Quatro temas conferidos em composições sobre fundos claros, escuros e com texto, **com desfoque CSS desligado**. Texto principal/secundário sobre as superfícies testadas: contraste mínimo 4,95:1; ícones da lista do navegador: mínimo 4,71:1. Método: cores CSS computadas, composição alfa sobre preto/branco, luminância sRGB WCAG. Não é uma auditoria completa de acessibilidade nem uma medida dos pixels do Windows.

## Regressões cobertas

1. Dois envios consecutivos não duplicam o atalho.
2. Troca de categoria/bola e cancelamento do seletor preservam o .exe escolhido.
3. Falha ao registrar F8 não impede salvar o tema seguinte, não perde o formulário e mantém o atalho anterior.
4. Foco entra na lista compacta e retorna ao fechar configurações.
5. Nomes longos cabem no setor em janela normal e baixa, com nome completo acessível.
6. Salvar o atalho de teclado preserva o nome e URL em edição.
7. O + de Streaming permanece visível e abre o formulário correto.
8. Interface e backend aceitam até 80 caracteres Unicode; a interface rejeita 81.

Os testes de seletor e de conflito de atalho em `tests/regressions.spec.ts` simulam **somente a fronteira IPC**. Não abrem diálogos do sistema nem registram teclas no Windows. Os testes Rust validam dados e substituição transacional do registro, usando implementações de teste.

## Pendente no Windows

- Selecionar, cancelar, salvar e abrir pasta/.exe pelo seletor real; testar jogos portáteis e diretório de trabalho.
- Conferir composição transparente, ativação global, foco externo e múltiplos monitores com DPI misto.
- Gerar e testar instalação/desinstalação NSIS em ambiente limpo.

Os auxiliares `tools/check-native.mjs` e `tools/check-rest-native.mjs` são para Windows e não foram executados nesta rodada. O primeiro agora espera 720×440 DIP e respeita a política de execução PowerShell vigente.
