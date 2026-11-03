# Orbit 0.1.1 — Windows x64 (versão de teste)

[Baixar o ZIP atualizado](https://github.com/miguelvianasecundario-netizen/lanchonete/raw/refs/heads/orbit-download-v0.1.0/downloads/orbit-windows-x64-v0.1.1.zip)

Menu menor: janela de **560 × 360**, círculo de até **290 px**, sem cabeçalho ou título. O painel de configurações também ficou compacto.

1. Encerre o Orbit antigo pelo ícone na bandeja → **Encerrar Orbit**.
2. Extraia **todos** os arquivos na mesma pasta e execute `orbit.exe`.
3. Para escolher o atalho, abra a **engrenagem**, clique no campo **Atalho de teclado**, pressione a tecla ou combinação desejada e clique **Salvar**. Exemplos: **F8** ou **Ctrl + Shift + O**.

Mantenha `WebView2Loader.dll` junto do executável. Requer Windows 11 x64 e Microsoft Edge WebView2 Runtime.

- Abrir: **Alt + clique central** ou o atalho escolhido (inicialmente **Ctrl + Alt + Espaço**).
- Ocultar: **Esc**.
- Encerrar: ícone na bandeja → **Encerrar Orbit**.

O novo atalho é aplicado e salvo. Em conflito, o anterior continua ativo. Letras/números/Espaço exigem Ctrl ou Alt. F12 é reservada pelo Windows.

Compilação Windows concluída. 16 cenários Playwright e 11 testes Rust aprovados. A execução nativa em Windows ainda não foi validada neste ambiente Linux. O ZIP é um build de teste, não um instalador, e não possui assinatura digital.

SHA-256: `8756f3b83c8273e0310d400457ba314a61e619f1a0e725d3119247afa1d9d317`.

O código-fonte e o README completo estão nesta mesma branch. A branch `main` não foi alterada. O nome da branch conserva a identificação da primeira publicação; os arquivos aqui são da versão **0.1.1**.
