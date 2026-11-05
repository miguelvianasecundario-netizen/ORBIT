# ORBIT 0.1.7 — Work

[**Baixar para Windows x64**](https://github.com/miguelvianasecundario-netizen/lanchonete/raw/refs/heads/orbit-download-v0.1.0/downloads/orbit-windows-x64-v0.1.7.zip) · [**Baixar o código-fonte**](https://github.com/miguelvianasecundario-netizen/lanchonete/raw/refs/heads/orbit-download-v0.1.0/downloads/orbit-codigo-fonte-v0.1.7.zip)

- Terceiro menu **Work**, com **Abrir tudo** e resultado por atalho.
- Adicione links, pastas e executáveis em qualquer menu/categoria. Ícones obtidos automaticamente.
- Integração com Brave para reconhecer URLs já abertas no perfil conectado e abrir somente as ausentes em segundo plano.
- Solicita apps minimizados, preserva os que já estão rodando e mantém Principal/Descanso, temas e dados anteriores.

1. Encerre o Orbit anterior pela bandeja.
2. Extraia todos os arquivos e abra `orbit.exe`, com `WebView2Loader.dll` junto dele.
3. Para os sites do Work: **engrenagem → Preparar extensão do Brave**, depois `brave://extensions` → Modo de desenvolvedor → Carregar sem compactação. Selecione a pasta aberta pelo Orbit.

[Guia da extensão](../browser-extension/README.md) · [Relatório dos testes](../VALIDACAO.md)

Foram cobertos 72 casos de interface, 32 testes Rust e 5 testes da extensão, além do host Rust e compilação. O executável foi compilado em Linux; conexão completa com Brave real, ícones nativos e minimização/foco ainda precisam de validação no Windows. Alguns programas podem ignorar a solicitação de minimizar.

![Prévia composta no Chromium; não é captura nativa do Windows](orbit-v0.1.7-preview.png)

Requer Windows 11 x64 e WebView2. Pacote portátil sem assinatura digital.

SHA-256 do aplicativo: `398084543268ae4f30e31c1efa7f8e0b015167ee9d3aef9dc2ba7855ced4c3e7`. [Checksum do código-fonte](orbit-codigo-fonte-v0.1.7.sha256).

Fonte: `af3f989abc4bd90868a0bc54ef44e65147ddba81`. [Versão anterior 0.1.6](orbit-windows-x64-v0.1.6.zip).
