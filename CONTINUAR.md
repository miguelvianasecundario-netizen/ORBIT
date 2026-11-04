# Continuar ORBIT 0.1.5 em outro computador

## Pedido implementado
Enquadramento ampliado 720x440, temas Oceano/Ametista/Grafite/Papel, setas laterais Principal/Descanso, balanço de 200 ms, Streaming com seis serviços, Jogos com .exe e opções diretas na bola para pasta/link/executável (ex.: Livros). Páginas de quatro setores evitam diminuir os nomes.

## Estado atual
Código e release 0.1.5 gerados. 50 testes de interface e 23 Rust passaram; Clippy sem avisos. A versão abriu no Windows. Não confundir com a pasta antiga outputs/ORBIT (fonte 0.1.0); o código correto é o deste ZIP, originado de work/orbit-source.

## O que falta
1. Completar teste nativo: Jogos > Adicionar jogo > escolher .exe > salvar > abrir; verificar diretório de trabalho de jogo portátil.
2. Completar teste nativo: Livros > escolher pasta > salvar > abrir pela bola; verificar cancelamento do seletor e persistência após reiniciar.
3. O auxiliar tools/check-rest-native.mjs parou ao chamar tools/native-input.ps1, bloqueado pela política de scripts PowerShell. Usar o controle de interface disponível para continuar; não alterar políticas de segurança. Os testes Playwright já existentes rodam normalmente.
4. Opcional de acabamento: substituir o botão Adicionar streaming no final da lista por um + no cabeçalho. Os seis serviços já cabem inteiros; esse botão extra requer rolagem.
5. Testar instalador em ambiente limpo e DPI misto em múltiplos monitores.

## Abrir o aplicativo
Extraia orbit-windows-x64-v0.1.5.zip e execute orbit.exe. Requer Windows 11 x64/WebView2. Encerre outra instância antes. Não é necessário compilar para usar.

## Desenvolver
Node 22.12+ ou 24, Rust MSVC, Build Tools C++/Windows SDK, WebView2. Execute npm.cmd ci; npm.cmd run tauri -- dev. Validação e build completos no README.md. Não publicar nem enviar mensagens a terceiros sem pedido.

## Dados existentes
O código-fonte e o ZIP portátil não incluem os atalhos/histórico pessoais. Eles ficam em %LOCALAPPDATA%\app.orbit.launcher\orbit.sqlite3 no computador original. Para migrar também esses dados, encerre o ORBIT e copie o banco para o mesmo diretório do outro computador. Caminhos de jogos/pastas precisam existir no destino.

## Arquitetura
Tauri/Rust + TypeScript, sem React. Settings.theme/mode têm defaults compatíveis. Novas categorias games/streaming/orbit-main/orbit-rest reutilizam a tabela de atalhos. Exemplos de arquivos centrais: src/main.ts, src/radial.ts, src/settings.ts, src/style.css, src-tauri/src/persistence.rs, models.rs, actions.rs, window_geometry.rs. Plano e decisões em docs/0.1.5-design.md.
