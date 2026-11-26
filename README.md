# Simulador: Queda livre e precisão matemática

Simulador web do salto de paraquedas da apresentação de Cálculo 1 (Bruno, João Vitor e Pedro).

## Como abrir

**Dê dois cliques em `index.html`.** Não precisa de internet, instalação nem servidor.
Para apresentar, aperte **F** para ficar em tela cheia.

> Leve a pasta inteira (`index.html` + `css/` + `js/`) num pendrive. O `index.html` sozinho não funciona.

## Estrutura

```
index.html          página com as 4 abas
css/style.css       visual (mesmas cores dos slides)
js/physics.js       TODA a matemática (sem interface)
js/chart.js         gráficos em canvas (sem bibliotecas)
js/app.js           animação, controles, réguas
tests/physics.test.js   confere os números dos slides
```

Para rodar os testes (opcional, precisa de Node): `node --test tests/physics.test.js`

## Roteiro sugerido (slide → aba)

| Slide | Aba | O que mostrar |
|---|---|---|
| Apresentação do problema | **Simulação** | Clique em *Saltar*. Os dois paraquedistas caem lado a lado. |
| Queda livre sem resistência | **1 · Sem resistência** | Integral de a → v → y. Arraste o tempo: **280 m/s no solo em 28,57 s**. |
| Altímetro barométrico | **2 · Altímetro** | P(h) = P₀·e^(−h/H) e a função inversa; regra da cadeia dP/dt. |
| Resistência do ar / Velocidade terminal | **3 · Velocidade terminal** | v_t = **45,36 m/s**, 99% em **12,25 s**, **411,1 m** percorridos, restam **3.588,9 m**. |
| Conclusão | **Simulação** | Arraste até o fim: sem ar → impacto; com ar + paraquedas → **pouso a 5,7 m/s**. |

Experimentos legais na aba Simulação:
- Desmarcar **Abrir o paraquedas**: impacto a 45 m/s (163 km/h).
- **Área do velame** em 10 m²: pouso duro.
- **Área do corpo** em 0,3 m² (de cabeça): velocidade terminal sobe para ~69 m/s.
- **Ar mais rarefeito no alto**: liga a Régua 2 à Régua 3 (cai mais rápido no alto).

Atalhos: `Espaço` saltar/pausar · `R` reiniciar · `1`–`4` trocar de aba · `F` tela cheia · clicar no céu também inicia/pausa.

## Modelo matemático

- Sem resistência: a = g, v = g·t, y = h₀ − ½·g·t²
- Com resistência: m·dv/dt = m·g − ½·ρ·C_d·A·v² → v(t) = v_t·tanh(g·t/v_t)
- Paraquedas: a área de arrasto cresce linearmente em 3 s (inflagem), C_d do velame = 1,5
- Atmosfera isotérmica: P(h) = 101.325·e^(−h/H), H = R·T/(M·g) ≈ 8.441 m
- A simulação completa é integrada numericamente (Runge-Kutta 4, Δt = 0,01 s) e conferida contra a solução analítica nos testes.
