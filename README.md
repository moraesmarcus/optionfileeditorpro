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
- Em pagina de jogo, permite escolher mandante, visitante ou ambos para importar titulares e reservas do mesmo time.
- Busca os dados individuais dos jogadores a partir dos links encontrados.
- Le o treinador quando ele aparece na pagina de jogo ou no plantel.
- Permite selecionar exatamente 25 jogadores do Transfermarkt.
- Monta a correspondencia dos 25 selecionados com os 25 slots do arquivo PES.
- Le a posicao registrada do jogador no arquivo PES e mostra codigo + descricao, como `LWF - Ponta Esquerda`.
- Prepara uma tela de gravacao com campos editaveis de equipe, tecnico e jogadores.
- Gera uma copia editada do `.bin` gravando equipe, abreviacao, tecnico, paises, nome, nome na camisa, posicao, pe forte, idade e numero da camisa dos jogadores.
- Valida a nacionalidade lida no Transfermarkt contra a lista de 220 nacionalidades do editor PES.
- Mostra alertas quando algum campo nao puder ser lido.

Esta versao ainda nao grava alteracoes no `.bin`.
