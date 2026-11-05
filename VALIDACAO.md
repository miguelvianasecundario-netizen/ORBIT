# Validação — ORBIT 0.1.7

Ambiente: Linux, Node 24, Chromium 155 e Rust, com compilação cruzada para Windows x64 GNU. Base: fonte 0.1.5 enviada pelo usuário e correções 0.1.6. [Relatório 0.1.6](docs/validation-v0.1.6.md).

## Resultados

- **72 testes Playwright**: três modos, cadastro por categoria/bola, preservação de preferências, nomes, foco, repetição de cliques, Work vazio, resultado de lote, atalho Work individual e carregamento/fallback de ícones.
- **32 testes Rust**: validação e persistência, escopo do Work, arquivo removido, histórico apenas de novas aberturas, autenticação, rejeição de segundo perfil, framing limitado, IDs de resposta incorretos, caminhos UNC e ícones declarados em HTML.
- **5 testes Node da extensão**: URLs abertas e pendentes, duplicação no lote, janela minimizada quando não há janela normal, falhas por item, URLs inválidas e serialização de pedidos simultâneos com heartbeat. A API do Chrome é simulada nesses testes.
- **Host Rust real aprovado** em `tools/check-native-host.mjs`: processo Linux, stdin/stdout binários, conexão TCP em localhost, token, encaminhamento nos dois sentidos e encerramento ao fechar a entrada. O lado Orbit da conexão é um cliente de teste; não envolve Brave nem registro Windows.
- **TypeScript/Vite aprovados. Clippy sem avisos**, com `-D warnings`, no núcleo Linux e no alvo Windows.
- **Release Windows x64** compilado com `custom-protocol`, interface incorporada e `WebView2Loader.dll`. Verificação de ZIP, SHA-256, versões e arquivos incorporados acompanha o empacotamento. O executável não foi executado no Windows nesta rodada.

Na última execução completa da interface, 71 casos passaram e o teste de lote avançou antes de terminar seu cadastro assíncrono. O teste passou a aguardar a confirmação visível de salvamento; os 13 casos Work foram então reexecutados e passaram. Os 72 casos acima descrevem a cobertura final dessas execuções.

## Interface e correções

Layouts anteriores: 720×440, 620×380, 540×340, 380×264 e 320×480, com fatores de rasterização 100%, 125%, 150% e 200%. Work também foi verificado em 720×440, 380×264 e 320×480. Isso não emula monitores físicos com DPI misto.

A suíte encontrou transbordamento transitório da lista em uma janela estreita e alta, causado pela rotação da animação. No layout compacto, a lista agora usa um deslocamento vertical curto; a bola mantém seu balanço de 200 ms. Movimento reduzido continua respeitado.

O botão de adicionar da categoria recebeu um rótulo distinto do botão que confirma o formulário. Ícones têm espaço fixo e imagem carregada antes de ocultar o símbolo de reserva; nenhum texto passa a depender da presença do favicon.

As composições dos quatro temas foram conferidas sobre fundos claros/escuros com texto, sem desfoque CSS. Contraste calculado: texto mínimo **4,95:1**, símbolos da lista do Navegador mínimo **4,71:1**. Método: cores CSS computadas, composição alfa sobre preto/branco e luminância sRGB WCAG. Não é uma auditoria completa nem uma medição dos pixels do Windows; não mede as cores internas de logos remotos.

Os testes em `tests/helpers/native-boundary.ts` simulam **somente o IPC**. Eles não registram teclas no Windows, não abrem seletores reais, não extraem ícones de `.exe` e não iniciam programas. Favicons externos são substituídos por fixtures quando interceptáveis; ícones nativos são verificados com imagem incorporada, sem depender de um site real.

## Limites e verificações pendentes

O teste completo `tools/check-brave-extension.mjs` tentou carregar a extensão real no Chromium com perfil temporário. A política gerenciada `ExtensionInstallBlocklist: ["*"]` bloqueou a instalação; ela não foi alterada. Portanto, **a extensão não foi validada conectada ao Brave real** nesta entrega. O ID calculado da chave pública do manifesto e a origem esperada pelo host foram conferidos.

Ainda precisam de validação no Windows:

- Preparar a extensão, conferir a chave HKCU, carregar/recarregar no Brave e obter **Brave conectado**.
- Abrir duas vezes o mesmo Work, verificar abas existentes/pendentes e confirmar que a aba ativa não muda; repetir com Brave fechado e com perfis diferentes.
- Confirmar minimização e foco com aplicativos reais, iniciadores, aplicativos já abertos e Explorador. Programas podem ignorar o estado solicitado, abrir processos filhos diferentes ou pedir elevação; o Orbit não garante minimizar todos eles.
- Verificar ícones reais de executáveis/pastas e downloads HTTPS de ícones pelo WinHTTP.
- Seletores nativos, hooks globais, transparência sobre o desktop, monitores físicos com DPI misto e instalação/desinstalação NSIS.

Os scripts Windows anteriores em `tools/check-native.mjs` e `tools/check-rest-native.mjs` não foram executados nesta rodada. O teste completo da extensão em Chromium Linux também não substitui os fluxos Windows acima.
