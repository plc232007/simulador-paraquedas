# Simulador: Queda livre e precisão matemática

Simulador web do salto de paraquedas da apresentação de Cálculo 1 (Bruno, João Vitor e Pedro).

**Acesse online:** https://plc232007.github.io/simulador-paraquedas/

<img src="qrcode.png" width="200" alt="QR code do simulador">

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
js/scene.js         desenho do salto (paraquedista, velame, avião, nuvens, chão)
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

### Como abrir o paraquedas

1. Clique em **▶ Saltar**: o paraquedista sai do avião.
2. Durante a queda, clique em **🪂 ABRIR PARAQUEDAS** ou aperte **P**. O ideal é abrir entre 1.500 e 900 m; abaixo de 1.000 m o botão pisca em vermelho.
3. A abertura acontece em fases, como na vida real: **extrator** (0,6 s) → **linhas esticam** (0,8 s) → **velame infla** (2,1 s).
4. Se você esquecer, o **AAD** (dispositivo de segurança) abre sozinho a 225 m.

No painel, **Paraquedas** tem 3 modos: *Eu abro* (botão), *Automático* (numa altitude escolhida) e *Não abrir*.
**Câmera**: *Seguir* acompanha o paraquedista (nuvens, vento, chão chegando); *Visão geral* mostra os dois saltos lado a lado (tecla **C**).

Experimentos legais na aba Simulação:
- **Não abrir**, ou desligar o AAD e não apertar o botão: impacto a 45 m/s (163 km/h).
- **Área do velame** em 10 m²: pouso duro.
- **Área do corpo** em 0,3 m² (de cabeça): velocidade terminal sobe para ~69 m/s.
- **Ar mais rarefeito no alto**: liga a Régua 2 à Régua 3 (cai mais rápido no alto).

Atalhos: `Espaço` saltar/pausar · `P` abrir paraquedas · `C` trocar câmera · `R` reiniciar · `1`–`4` trocar de aba · `F` tela cheia · clicar no céu também inicia/pausa.

## Modelo matemático

- Sem resistência: a = g, v = g·t, y = h₀ − ½·g·t²
- Com resistência: m·dv/dt = m·g − ½·ρ·C_d·A·v² → v(t) = v_t·tanh(g·t/v_t)
- Paraquedas: extrator (+0,6 m² de arrasto) → linhas → velame enche em curva suave até C_d·A = 1,5 × 30 m² (3,5 s no total); pico de ~3,7 g
- AAD: abre sozinho se passar de 225 m acima de 35 m/s
- Atmosfera isotérmica: P(h) = 101.325·e^(−h/H), H = R·T/(M·g) ≈ 8.441 m
- A simulação completa é integrada numericamente (Runge-Kutta 4, Δt = 0,01 s) e conferida contra a solução analítica nos testes.
