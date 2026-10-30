# Configurar un nuevo perfil de Hermes para trabajar con el bot 1HZ50V

Este documento explica cómo clonar el entorno del perfil `deriv` (skills, plugins, scripts, config) a un nuevo perfil de Hermes para trabajar con el bot de trading 1HZ50V.

---

## 1. Estructura del perfil `deriv` (referencia)

El perfil activo vive en:

```
~/.hermes/profiles/deriv/
├── config.yaml
├── skills/
│   └── software-development/
│       ├── v25-hma-mladen-strategy/   <-- skill de la estrategia
│       └── trading-strategy-backtesting/
├── plugins/
├── cron/
├── memories/
├── scripts/
│   └── v25-strategy/                  <-- código Python del bot
│       ├── bot_1hz50v_demo.py
│       ├── strategy.py
│       ├── strategy_binary_candles.py
│       ├── live_trader.py
│       ├── config.yaml
│       ├── ESTRATEGIA.md
│       └── ...
├── logs/
└── data/
```

---

## 2. Crear el nuevo perfil

Desde la terminal:

```bash
# Elegir un nombre para el nuevo perfil (ej: "trading-bot")
NEW_PROFILE="trading-bot"

# Crear directorios base
mkdir -p ~/.hermes/profiles/$NEW_PROFILE/{skills,plugins,cron,memories,scripts,logs,data}

# Copiar configuración base (si existe)
cp ~/.hermes/profiles/deriv/config.yaml ~/.hermes/profiles/$NEW_PROFILE/config.yaml 2>/dev/null || true
```

---

## 3. Copiar skills del perfil deriv

Las skills son procedimientos reutilizables. Copia las relevantes para trading y backtesting:

```bash
NEW_PROFILE="trading-bot"

cp -r ~/.hermes/profiles/deriv/skills/software-development/v25-hma-mladen-strategy \
      ~/.hermes/profiles/$NEW_PROFILE/skills/software-development/

cp -r ~/.hermes/profiles/deriv/skills/software-development/trading-strategy-backtesting \
      ~/.hermes/profiles/$NEW_PROFILE/skills/software-development/

# Opcional: skills de planificación y desarrollo
cp -r ~/.hermes/profiles/deriv/skills/software-development/writing-plans \
      ~/.hermes/profiles/$NEW_PROFILE/skills/software-development/

cp -r ~/.hermes/profiles/deriv/skills/software-development/plan \
      ~/.hermes/profiles/$NEW_PROFILE/skills/software-development/

cp -r ~/.hermes/profiles/deriv/skills/software-development/subagent-driven-development \
      ~/.hermes/profiles/$NEW_PROFILE/skills/software-development/

cp -r ~/.hermes/profiles/deriv/skills/software-development/debugging-hermes-tui-commands \
      ~/.hermes/profiles/$NEW_PROFILE/skills/software-development/
```

---

## 4. Copiar plugins

Si el perfil deriv tiene plugins instalados:

```bash
NEW_PROFILE="trading-bot"

cp -r ~/.hermes/profiles/deriv/plugins/* ~/.hermes/profiles/$NEW_PROFILE/plugins/ 2>/dev/null || true
```

---

## 5. Copiar scripts del bot (v25-strategy)

El código Python del bot vive en `scripts/v25-strategy/`:

```bash
NEW_PROFILE="trading-bot"

cp -r ~/.hermes/profiles/deriv/scripts/v25-strategy \
      ~/.hermes/profiles/$NEW_PROFILE/scripts/
```

Esto incluye:
- `bot_1hz50v_demo.py` — bot para Raspberry Pi/demo
- `strategy.py` — indicadores HMA + Mladen Flow
- `strategy_binary_candles.py` — backtester binary
- `live_trader.py` — bot live original
- `config.yaml` — parámetros de la estrategia
- `ESTRATEGIA.md`, `README.md`, `RESUMEN.md` — documentación

---

## 6. Copiar memoires (opcional)

Si quieres heredar notas y conclusiones previas del perfil deriv:

```bash
NEW_PROFILE="trading-bot"

cp -r ~/.hermes/profiles/deriv/memories/* ~/.hermes/profiles/$NEW_PROFILE/memories/ 2>/dev/null || true
```

> **Nota:** No copies archivos con tokens, secretos o claves privadas (`.env`, `*.pem`, `*.key`).

---

## 7. Configurar el nuevo perfil

Edita el archivo de configuración:

```bash
nano ~/.hermes/profiles/$NEW_PROFILE/config.yaml
```

Asegúrate de que incluya al menos:

```yaml
profile: trading-bot
active_skills:
  - software-development/v25-hma-mladen-strategy
  - software-development/trading-strategy-backtesting
  - software-development/writing-plans

scripts_dir: ~/.hermes/profiles/trading-bot/scripts/v25-strategy

# Deriv API (configura tu token en variable de entorno, no aquí)
deriv:
  app_id: 1089
  ws_endpoint: wss://ws.binaryws.com/websockets/v3
  trading_ws: wss://api.derivws.com/trading/v1/options/ws/public
```

---

## 8. Variables de entorno

Crea un archivo `.env` en la carpeta de scripts (o exporta antes de ejecutar):

```bash
# ~/.hermes/profiles/trading-bot/scripts/v25-strategy/.env
DERIV_TOKEN=tu_token_de_demo_aqui
DERIV_SYMBOL=1HZ50V
DERIV_STAKE=10.0
DERIV_DURATION=1
DERIV_HMA_PERIOD=20
DERIV_FLOW_PERIOD=14
DERIV_FLOW_THRESHOLD=0.0
DERIV_DEMO=true
```

**Nunca subas este archivo a GitHub.** Usa `.env.example` como plantilla.

---

## 9. Activar el perfil en Hermes

Para que Hermes use este perfil en una sesión:

```bash
export HERMES_PROFILE=trading-bot
```

O ejecuta Hermes especificando el perfil:

```bash
hermes --profile trading-bot
```

---

## 10. Verificar que todo funciona

```bash
# 1. Ver skills disponibles
hermes skills list

# 2. Ver que el skill de la estrategia esté cargado
hermes skill view software-development/v25-hma-mladen-strategy

# 3. Ir a la carpeta de scripts y probar el backtest
cd ~/.hermes/profiles/trading-bot/scripts/v25-strategy

# 4. Backtest en PAPER (sin token)
python3 strategy_binary_candles.py backtest 1HZ50V_1m.csv 1 0.85 20 14

# 5. Ejecutar el bot en PAPER
python3 bot_1hz50v_demo.py
```

---

## 11. Comandos útiles de gestión de perfiles

```bash
# Listar perfiles existentes
ls ~/.hermes/profiles/

# Ver perfil activo
echo $HERMES_PROFILE

# Cambiar perfil en la sesión actual
export HERMES_PROFILE=trading-bot

# Ver configuración del perfil activo
cat ~/.hermes/profiles/$HERMES_PROFILE/config.yaml
```

---

## 12. Advertencias

- **`mladen_flow()` es un placeholder** (ver `ESTRATEGIA.md` §8). Reemplázalo por la fórmula original de TradingView antes de operar con dinero real.
- **Empieza en PAPER** (sin `DERIV_TOKEN`) para validar señales antes de operar en demo.
- **No compartas tu token.** Configúralo en cada entorno por separado mediante variable de entorno.
- Los backtests pasados no garantizan resultados futuros. Los índices sintéticos (R_25, 1HZ50V) son altamente volátiles.

---

*Generado para el proyecto deriv-bot-next — perfil Hermes `deriv` → nuevo perfil.*
