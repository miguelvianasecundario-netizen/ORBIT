# Orbit Work para Brave

A extensão consulta as abas ao receber um pedido do Orbit. Reutiliza URLs já abertas ou em carregamento e cria somente as ausentes, com `active: false`. Se não houver janela normal, solicita uma janela minimizada e sem foco. Pedidos simultâneos entram em fila.

## Instalar

1. Extraia o ZIP do Orbit e abra `orbit.exe`.
2. No Orbit: engrenagem → **Brave no Work → Preparar extensão**.
3. No Brave: `brave://extensions` → **Modo de desenvolvedor** → **Carregar sem compactação**.
4. Escolha a pasta que o Orbit abriu: `%LOCALAPPDATA%\app.orbit.launcher\browser-extension`.
5. Abra o popup da extensão e confira a conexão; use **Reconectar** se necessário.

Carregar apenas a pasta incluída no ZIP, sem antes usar **Preparar extensão**, não registra o host nativo. Prefira a pasta preparada pelo aplicativo; ela recebe as atualizações dos arquivos incorporados ao executável.

Ao atualizar o Orbit, encerre a versão anterior, abra a nova e clique no botão de recarregar da extensão em `brave://extensions`. O Orbit atualiza automaticamente o caminho do host já preparado quando é iniciado pela nova pasta.

## Se não conectar

- Mantenha o Orbit aberto na bandeja. Não apague ou mova a pasta do executável enquanto estiver usando a integração.
- Confira que carregou a pasta contendo `manifest.json`, não o ZIP ou a pasta acima dela.
- Use **Preparar extensão** novamente se o Orbit mudou de pasta; depois recarregue a extensão e use **Reconectar**.
- A mensagem de outro perfil conectado indica que a extensão está ativa em outro perfil. Desative-a nesse perfil antes de reconectar no desejado.
- Políticas de um navegador gerenciado podem bloquear extensões ou comunicação nativa. Respeite as regras desse ambiente; o Orbit informa a indisponibilidade dos sites e mantém os outros atalhos disponíveis.

## Comportamento

A deduplicação usa a URL HTTPS completa e normalizada. Parâmetros e fragmentos são preservados. Uma página de login ou uma rota diferente após redirecionamento pode não ser igual à URL cadastrada. Não compara apenas o domínio, pois isso impediria abrir páginas distintas do mesmo serviço.

As abas verificadas pertencem ao perfil conectado. Não há verificação de outras máquinas, perfis ou janelas privadas sem acesso. O Orbit não ativa abas existentes, não fecha abas e não armazena uma lista de navegação.

## Integração

ID estável: `gdlabbbhfoddkklcganebipckpnaflio`. Host: `app.orbit.launcher.browser`.

O manifesto contém apenas a chave **pública** necessária para manter o ID. O registro é feito em HKCU, na chave `Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\app.orbit.launcher.browser`, apontando para o manifesto local. O mesmo `orbit.exe` atende ao protocolo native messaging quando chamado pela extensão; não precisa iniciar outra interface.

O host encaminha quadros JSON com tamanho de 32 bits little-endian e limite de 1 MiB. A conexão é local e autenticada por token por execução. O navegador só responde a pedidos de URLs; não recebe uma API para executar comandos arbitrários.

`npm run test:extension` testa URLs, abas existentes/pendentes, falhas, criação sem janela e fila de pedidos com a API Chrome simulada. `tools/check-brave-extension.mjs` é um teste adicional para Chromium Linux não gerenciado, com perfil temporário e host Rust compilado; ele foi bloqueado pela política de extensões do ambiente desta entrega. Não substitui a validação de registro e foco no Brave/Windows.
