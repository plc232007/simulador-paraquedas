# Salto de Paraquedas: Queda livre e precisão matemática

Jogo de paraquedismo da apresentação de Cálculo 1 (Bruno, João Vitor e Pedro).

**Jogue online:** https://plc232007.github.io/simulador-paraquedas/

<img src="qrcode.png" width="200" alt="QR code do jogo">

## Como jogar

| Momento | Teclado | Celular |
|---|---|---|
| No avião, com a **luz verde** | `Espaço` salta | botão **SALTAR** |
| Queda livre, entre 1.500 e 900 m | `Espaço` abre o paraquedas | botão **ABRIR PARAQUEDAS** |
| Com o velame aberto | `←` `→` pilotam até o alvo | botões ◀ ▶ |
| A 3–5 m do chão | segure `↓` (ou `Espaço`) para frear | segure **FREAR** |

Pontuação (3 estrelas): pouso seguro (≤ 7 m/s), no alvo (≤ 10 m) e suave (≤ 4 m/s, só com o flare).
Se você esquecer de abrir, o **AAD** (dispositivo de segurança) abre sozinho a 225 m.

Outros atalhos: `Esc` pausa · `X` ritmo do tempo (Auto acelera a descida longa sob o velame) · `M` mostra/esconde os cálculos · `F` tela cheia · `R` novo salto.

## A matemática na tela (painel ∫)

1. **Sem resistência do ar:** v = g·t, y = h₀ − ½·g·t² (integrais da aceleração). Mostra quando você já teria batido no chão: 28,6 s a 280 m/s.
2. **Altímetro:** P = P₀·e^(−h/H) e a inversa h = −H·ln(P/P₀). Calcula a altitude a partir da pressão.
3. **Com resistência do ar:** v_t = √(2mg/ρC_dA) = 45,36 m/s e v(t) = v_t·tanh(gt/v_t), cujo limite para t → ∞ é v_t. Com o velame aberto: v_t ≈ 5,66 m/s.

Ao pousar, o resultado mostra o gráfico de v(t) do seu salto comparado com a queda sem ar.

## Rodar sem internet

Dê dois cliques em `index.html` (mantenha as pastas `css/` e `js/` junto). Não precisa instalar nada.

## Estrutura

```
index.html      página única do jogo
css/style.css   visual
js/physics.js   matemática (modelos dos slides + integração em tempo real)
js/scene.js     desenho (avião, paraquedista, velame, nuvens, chão, alvo)
js/game.js      controles, HUD, cálculos ao vivo e resultado
tests/          testes da física: node --test tests/physics.test.js
```

## Modelo

- Vertical: m·dv/dt = m·g − ½·ρ·C_d·A·v², integrado com Runge-Kutta 4 (Δt = 0,01 s) e conferido com a solução analítica.
- Abertura em fases: extrator (0,6 s) → linhas (0,8 s) → velame enche (2,1 s); pico de ~3,7 g.
- Velame: voa a ~9 m/s na direção para onde aponta; o vento soma; o flare aumenta o arrasto por ~2 s.
- Atmosfera isotérmica: H = R·T/(M·g) ≈ 8.441 m.
