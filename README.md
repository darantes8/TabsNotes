# TabNotes

Notas flutuantes independentes por aba para Google Chrome.

## Funcionalidades

- `Ctrl + Alt + N` mostra ou oculta as notas.
- Nenhum elemento fica visível quando o sistema está oculto.
- Cada aba possui suas próprias notas.
- Múltiplas notas por aba.
- Título e texto.
- Drag livre.
- Resize pelas quatro bordas e quatro quinas.
- Minimização com título e contraste automático preto/branco conforme a cor da nota.
- Nota minimizada também pode ser arrastada.
- Paleta com 18 cores: 6 famílias em tons escuros, médios e claros.
- Cores escolhidas entram no seletor rápido do próprio card.
- Controle de fonte em 7 níveis internos, com botões `+-` e sem exibir o nível.
- Toggle de alinhamento: esquerda, centro, direita e justificado.
- Barra de ferramentas recolhível.
- Abas normais usam `chrome.storage.local`.
- Abas anônimas usam `chrome.storage.session`.

## Estrutura

```text
tabNotes/
├── manifest.json
├── readme.md
└── src/
    ├── background.js
    ├── content.js
    └── styles.css
```
