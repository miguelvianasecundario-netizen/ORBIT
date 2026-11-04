# ORBIT 0.1.6 — Windows x64

[**Baixar o aplicativo**](https://github.com/miguelvianasecundario-netizen/lanchonete/raw/refs/heads/orbit-download-v0.1.0/downloads/orbit-windows-x64-v0.1.6.zip) · [**Baixar o código-fonte**](https://github.com/miguelvianasecundario-netizen/lanchonete/raw/refs/heads/orbit-download-v0.1.0/downloads/orbit-codigo-fonte-v0.1.6.zip)

Baseado no código-fonte 0.1.5 enviado pelo usuário. Preserva modos Principal/Descanso, quatro temas, jogos, pastas, atalhos e dados locais.

- Corrige duplicação de cadastro, perda da seleção de pasta/.exe e perda do rascunho ao salvar o atalho global.
- Falhas de atalho global deixam as outras preferências continuarem salvando; foco de teclado acompanha a navegação.
- Nomes longos ficam dentro dos setores. Base do círculo, texto secundário e ícones claros ganharam contraste.
- O + para adicionar streaming fica no cabeçalho.

![Prévia composta no Chromium, sem desfoque; não é captura nativa do Windows](orbit-v0.1.6-preview.png)

1. Encerre a versão anterior pela bandeja → **Encerrar Orbit**.
2. Extraia **todos os arquivos** e abra `orbit.exe`, com `WebView2Loader.dll` junto dele.
3. Abra com **Alt + clique central** ou seu atalho salvo. Suas preferências são preservadas.

**59 testes da interface e 23 Rust passaram**, além do build e Clippy do núcleo. Após o acabamento final, 21 testes afetados foram repetidos e passaram. O executável foi compilado em Linux para Windows x64; execução nativa da 0.1.6, seletores reais e monitores físicos ainda precisam de validação no Windows. [Relatório completo](../VALIDACAO.md).

Requer Windows 11 x64 e WebView2 Runtime. Pacote portátil sem assinatura digital.

SHA-256 do aplicativo: `eed026c9cd83d5b3d8b535332426596f685d7c1dd392bf112cde564998b93a89`. [Checksum do código-fonte](orbit-codigo-fonte-v0.1.6.sha256).

Código da compilação: `ecf246d38d5f861b6a7b084c1ff0fd9ab3a39379`. A branch `main` foi preservada. [Download anterior 0.1.3](orbit-windows-x64-v0.1.3.zip).
