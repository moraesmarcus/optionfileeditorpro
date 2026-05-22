# Option File Editor Pro

Primeira versao de leitura para cruzar um arquivo descriptografado do PES com paginas do Transfermarkt.

## Como executar

No Windows, abra:

```powershell
abrir_app.cmd
```

Ou rode manualmente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1
```

Depois acesse `http://localhost:4173`.

## O que esta versao faz

- Le o arquivo `.bin` descriptografado e lista os 25 jogadores encontrados.
- Le uma URL do Transfermarkt usando um servidor local.
- Tambem aceita HTML salvo do Transfermarkt.
- Extrai dados de pagina de jogo, plantel e jogador individual.
- Busca os dados individuais dos jogadores a partir dos links encontrados.
- Permite selecionar exatamente 25 jogadores do Transfermarkt.
- Monta a correspondencia dos 25 selecionados com os 25 slots do arquivo PES.
- Mostra alertas quando algum campo nao puder ser lido.

Esta versao ainda nao grava alteracoes no `.bin`.
