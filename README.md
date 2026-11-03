# ORBIT

Versão **0.1.2** — menu compacto de **380 × 264**, círculo de até **208 px**, anel mais fino, sem cabeçalho ou título, engrenagem centralizada embaixo e configurações compactas.

Launcher radial para Windows 11, com Tauri 2, Rust e TypeScript. A interface usa SVG e CSS, sem framework de UI. O visual inspirado em Liquid Glass usa transparência, reflexos brancos, desfoque CSS e tons claros de menta, azul e pêssego. O menu de quatro categorias tem ramificações discretas; o centro e a região externa ficam transparentes. Não usa APIs da Apple. O efeito de desfoque do conteúdo de outras janelas depende do compositor/WebView2 e precisa de verificação no Windows.

[Baixar a versão de teste 0.1.2 para Windows x64](https://github.com/miguelvianasecundario-netizen/lanchonete/raw/refs/heads/orbit-download-v0.1.0/downloads/orbit-windows-x64-v0.1.2.zip)

## Executar no Windows 11

Instale **Node.js 22.12+ (ou 24 LTS)**, **Rust estável com o alvo MSVC**, **Visual Studio Build Tools** com “Desenvolvimento para desktop com C++” e Windows SDK, e **Microsoft Edge WebView2 Runtime**. O WebView2 normalmente já está presente no Windows 11.

No PowerShell, na raiz deste repositório:

```powershell
npm ci
npm run tauri dev
```

O Orbit abre inicialmente para apresentar os controles. Depois:

- **Alt + clique central** abre o menu perto do cursor em qualquer aplicativo comum.
- **Ctrl + Alt + Espaço** é o atalho global inicial; pode ser alterado em Configurações.
- Configurações permite escolher clique central sem Alt ou somente teclado. No campo **Atalho de teclado**, pressione a tecla/combinação desejada e clique **Salvar**. Ex.: **F8** ou **Ctrl + Shift + O**. A alteração é aplicada imediatamente e persiste ao reabrir.
- Letras, números e Espaço requerem Ctrl ou Alt. F1–F24 podem ser usadas sozinhas, exceto F12, reservada pelo Windows. Em conflito, a troca é recusada e o atalho anterior permanece ativo.
- Clique em uma categoria e depois em uma opção. Links usam o navegador padrão; aplicações são executadas pelo backend.
- O centro recolhe a categoria; Esc, clique fora e perda de foco ocultam o menu.
- O ícone na bandeja permite **Abrir Orbit** e **Encerrar Orbit**. Encerrar remove o hook e o atalho global; ocultar mantém o launcher disponível.

O clique que aciona o Orbit é consumido, inclusive a liberação correspondente. Com Alt + clique central, cliques centrais comuns continuam chegando aos outros aplicativos. O modo somente teclado não consome cliques. Não execute várias instâncias simultaneamente: o atalho global fica reservado pela primeira. Se outro aplicativo já reservou o atalho salvo, o início informa o conflito.

## Interface no navegador / Linux

```sh
npm ci
npm run dev
```

Abra o endereço exibido pelo Vite (porta 1420). A prévia abre links reais em novas abas, permite criar/remover atalhos HTTPS, ordena itens por uso e salva preferências em `localStorage`. Permita pop-ups se necessário. As mensagens identificam ações indisponíveis no navegador. Ativação por teclado ou mouse nessa prévia só funciona enquanto a página recebe eventos.

O executável desktop foi projetado para Windows. No Linux, `cargo test --lib` testa o núcleo de dados e segurança sem depender de GTK/WebKit; `cargo run` apenas informa que o desktop requer Windows.

## Gerar instalador

No Windows com os pré-requisitos acima:

```powershell
npm run tauri build
```

O instalador NSIS será gerado em `src-tauri/target/release/bundle/nsis/`. Ele não é assinado digitalmente. O repositório inclui um workflow Windows que executa os testes e gera o instalador como artefato quando executado no GitHub Actions. Nenhum instalador foi publicado por esta implementação.

## Funcionalidades

- **Navegador:** YouTube, ChatGPT, GitHub e Google.
- **Aplicativos:** Explorador de Arquivos, Bloco de Notas e VS Code nas pastas padrão de instalação.
- **Projetos:** seletor de pastas, cadastro e remoção de projetos favoritos, abertura das pastas cadastradas.
- **Ações:** Downloads (pasta conhecida do Windows, inclusive redirecionada), Configurações e Gerenciador de Tarefas.
- **Personalização:** atalhos HTTPS e pastas em qualquer categoria, acionamento e atalho de teclado configuráveis, limpeza do histórico.
- **Aprendizado local:** contagem, última utilização e até 10.000 eventos com horários em SQLite. As opções mais utilizadas aparecem primeiro na categoria. As categorias ficam em posições fixas. Nenhuma ação é executada por recomendação.
- **Windows:** janela transparente sem moldura, acima das outras quando visível; escolha do monitor pelo cursor; escala DPI e limites da área útil; ramificações para a esquerda perto da borda direita; lista rolável quando há muitos atalhos.
- **Acessibilidade:** nomes acessíveis, navegação com Tab, foco visível, Esc e respeito à preferência de movimento reduzido.

## Estrutura

```text
src/
  main.ts          estado da interface, navegação e eventos
  radial.ts        geometria SVG e categorias
  settings.ts      painel de preferências e atalhos
  hotkey.ts        captura explícita e comparação do atalho
  data.ts          categorias e ações padrão
  bridge.ts        comunicação Tauri / armazenamento da prévia
  types.ts         contrato de dados
  icons.ts         ícones SVG locais
  utils.ts         escape seguro de conteúdo
  style.css        vidro, animações e layouts
src-tauri/
  src/lib.rs       aplicação, comandos IPC, bandeja e ciclo de vida
  src/native.rs    hook Win32 e atalho global, thread e encerramento
  src/hotkey.rs    validação e troca transacional do atalho global
  src/window.rs    cursor, monitor, DPI e posicionamento
  src/actions.rs   execução de ações permitidas
  src/models.rs    contratos compartilhados
  src/persistence.rs SQLite, validação e testes
  capabilities/   permissões da janela local
  icons/          ícones do aplicativo
  tauri.conf.json  janela, CSP e instalador
  Cargo.lock      dependências Rust fixadas
public/orbit.svg   identidade vetorial
tests/orbit.spec.ts testes funcionais em navegador
.github/workflows/windows.yml compilação no Windows
```

`MenuItem` aceita `children` para novos níveis de navegação. Os dados ficam separados da geometria; novos tipos de ações nativas precisam de um executor explicitamente permitido no backend.

## Dados e segurança

SQLite fica no diretório de dados local de `app.orbit.launcher` retornado pelo Tauri (`%LOCALAPPDATA%` no Windows), em `orbit.sqlite3`. A prévia possui armazenamento independente, não sincronizado com o aplicativo. Apagar histórico mantém atalhos e preferências.

Nenhuma telemetria ou API paga. O hook observa exclusivamente a ativação do botão central e o estado de Alt; não captura texto digitado nem navegação. URLs aceitam apenas HTTPS sem credenciais. Pastas devem existir e ter caminho absoluto. Executáveis padrão são resolvidos por diretórios conhecidos do Windows; nenhum texto de histórico, URL ou nome de atalho é interpolado em comando de shell. Uso só é registrado após abertura bem-sucedida. Conteúdo personalizado é escapado na interface.

## Validação

```sh
npm run build
npx playwright install chromium
npm test
cargo test --lib --manifest-path src-tauri/Cargo.toml --locked
```

Se já houver Chromium instalado, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` com seu caminho e dispense o download. Neste ambiente Linux foi usado `/usr/bin/chromium`.

Resultados da implementação:

- Build TypeScript/Vite aprovado.
- 16 testes Playwright aprovados (incluindo seleção/persistência do atalho e tamanho compacto e engrenagem abaixo do círculo): categorias, quatro URLs com interceptação dos destinos, fechamento/retorno, atalhos persistentes, histórico, rejeição de URLs executáveis, limitações nativas, layout compacto e dimensionamento desktop com DPI alto. Os testes exercitam `window.open`; não verificam disponibilidade dos sites externos.
- 11 testes Rust aprovados (incluindo migração de preferências, conflito e falha de persistência do atalho): SQLite, persistência após reabertura, remoção, validação de URLs/pastas, IDs desconhecidos e limpeza de histórico.
- Verificação cruzada `cargo check --target x86_64-pc-windows-gnu --locked` aprovada, incluindo APIs Win32 e Tauri.
- Executável Windows x64 gerado em modo release por compilação cruzada GNU, com `custom-protocol` e interface incorporada (aproximadamente 4,3 MB). Requer `WebView2Loader.dll` ao lado do executável e WebView2 Runtime instalado. A execução desse binário ainda não foi validada em Windows.

### Validação manual ainda necessária no Windows

O ambiente de implementação é Linux. **A execução nativa no Windows, o instalador, a transparência do WebView2 e o hook global ainda precisam de teste real.** A compilação cruzada verifica tipos e APIs; não substitui os passos abaixo:

1. Abrir o desktop e confirmar transparência e ausência de moldura.
2. Ativar em cima de outro aplicativo com Alt + clique central e Ctrl + Alt + Espaço. Trocar o atalho em Configurações, confirmar a nova tecla e verificar que a anterior foi liberada.
3. Confirmar que clique central normal continua funcionando no modo padrão.
4. Testar Esc, clique fora, retorno, ações de sistema e seletor de projetos.
5. Testar bordas, barra de tarefas, monitores com coordenadas negativas e DPI 100%, 150%, 200%.
6. Encerrar pela bandeja e confirmar que mouse/atalho voltaram a funcionar sem captura do Orbit.
7. Gerar, instalar e desinstalar o NSIS em uma máquina de teste.

Programas elevados, desktops seguros e atalhos reservados pelo sistema podem restringir hooks de aplicativos comuns. Não há inicialização automática com Windows, detecção de executáveis fora dos caminhos padrão, edição de links/pastas existentes nesta versão; para alterar um atalho, remova e adicione novamente.
