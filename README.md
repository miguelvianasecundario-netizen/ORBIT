# ORBIT 0.1.5 — duas bolas, temas e atalhos próprios

## Abrir

Encerre a versão anterior pela bandeja, extraia o ZIP em uma pasta nova e abra `orbit.exe`. Windows 11 x64 com Microsoft Edge WebView2. Alt + clique central é o padrão; seu atalho salvo continua funcionando. Esc ou clique externo oculta o launcher.

## Principal e Descanso

Use as pequenas setas encostadas nas laterais da bola. O centro informa qual modo está ativo. A troca faz um balanço de **0,2 s**, desativado quando o Windows pede movimento reduzido. O último modo fica salvo.

- **Principal:** Aplicativos, Navegador, Projetos e Ações. Navegador mantém Nova guia do Brave (`brave://newtab/`).
- **Descanso:** Jogos, Streaming e espaço para opções suas.
- **Streaming:** Prime Video, Disney+, Netflix, HBO Max, Apple TV e Globoplay. Abre os sites oficiais no navegador padrão; não inclui assinatura dos serviços.
- **Jogos:** clique em Jogos > Adicionar jogo > Selecionar executável (.exe), escolha o arquivo e salve.
- **Livros:** clique na sugestão Livros, selecione sua pasta e salve. O novo botão abre a pasta diretamente no Explorador.
- **Mais opções na bola:** clique no + abaixo da bola ou em Adicionar; em Categoria escolha Direto na bola. Pode ser pasta, link HTTPS ou executável. Escolha Principal ou Descanso no campo Bola.
- **Mais de quatro opções:** use as setas de página ao lado do indicador abaixo da bola. As setas laterais grandes continuam trocando entre Principal e Descanso.
- **Remover:** engrenagem > lista de atalhos > lixeira. Remove somente o atalho do ORBIT.

## Temas e enquadramento

Engrenagem > Aparência: **Oceano, Ametista, Grafite e Papel**. A escolha é aplicada imediatamente, mantém o rascunho do formulário e fica salva.

Janela padrão de **720×440 unidades lógicas**. Bola de 304 px, área para as setas e lista separada. Os seis streamings cabem por inteiro no tamanho padrão. Abaixo de 620 px de largura ou 380 px de altura, bola e lista usam a mesma área em etapas. Abaixo de 320 px de altura, os setores viram uma grade para preservar a leitura. Controles de pelo menos 44 px; listas longas têm rolagem interna. A janela respeita a área útil do monitor e a escala do Windows.

## Dados e execução

Atalhos, histórico e preferências ficam em `%LOCALAPPDATA%\app.orbit.launcher\orbit.sqlite3`. A identidade do aplicativo e o formato dos atalhos existentes foram mantidos. Preferências antigas recebem tema Oceano e modo Principal automaticamente.

Arquivos .exe precisam existir e ter caminho absoluto. São iniciados sem shell nem argumentos, com a pasta do programa como diretório de trabalho. Pastas são validadas novamente antes de abrir. Links personalizados exigem HTTPS sem credenciais. Limite de 100 atalhos personalizados. Nenhum arquivo pessoal é removido ao excluir um atalho.

Na prévia web, links, temas e personalização por URL funcionam. Seletores de pastas/.exe, Brave e ações Windows precisam da versão desktop.

## Desenvolver e verificar

Node.js 22.12+ ou 24, Rust MSVC, Windows SDK/Visual Studio Build Tools C++ e WebView2.

```powershell
npm.cmd ci
npm.cmd run tauri -- dev
npm.cmd test
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
npm.cmd run tauri -- build
```

O Playwright utiliza Edge no Windows. `tools/check-rest-native.mjs` testa o executável Windows, criando e removendo apenas seus próprios atalhos de teste; habilita depuração somente nesse processo de teste. Não é usado no funcionamento normal.

## Referência dos streamings

Seleção para o Brasil baseada nos seis primeiros do ranking de interesse JustWatch publicado pela [Teleco](https://teleco.com.br/streaming_mshare.asp), consultado em 04/11/2026. Esse indicador não equivale a uma contagem de assinantes. Os endereços oficiais foram conferidos; alguns serviços podem exigir login ou assinatura.

O executável e o instalador não possuem assinatura digital. Consulte `VALIDACAO.md` para os testes realizados e limites de validação desta entrega.
