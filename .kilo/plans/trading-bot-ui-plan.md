# Trading Bot Implementation Plan

## Tab Structure (`/bot` route)

### Main Tabs (TRADE / STRATEGY / ANALYSIS)
Navigation via tabs with `TabsList` containing:
- **TRADE tab** (default): Live trading view
- **STRATEGY tab**: Strategy configuration
- **ANALYSIS tab**: Backtesting and analysis

---

## Tab 1: TRADE

### Layout
```
Grid: [340px sidebar] + [main content (chart + log)]
```

### Sidebar Section

#### Card: Settings
- **Symbol Selector** (Dropdown)
  - Options: R_10, R_25, R_50, R_75, R_100
  - Label text: "Symbol"
  - Button state: disabled when connected

- **Timeframe Buttons** (horizontal row)
  - Buttons: ["1m", "5m", "15m", "1D"]
  - Button variants: `default` (active) or `outline`
  - Button text: timeframe labels

- **Connection Status Dot**
  - Green dot (bg-green-500) = Connected
  - Red dot (bg-red-500) = Disconnected
  - Status text: "Connected" / "Disconnected"

#### Card: Indicators
- **Strategy Name** (heading)
  - Text from `STRATEGY_NAMES` map: 
    - `multi-momentum` → "Multi Momentum"
    - `fast-ema-sma-cross` → "EMA/SMA Cross Fast"
    - `adaptive-confluence` → "Adaptive Confluence"
    - `doji` → "Doji"

- **Parameters Section**
  - Label: "Parameters" (uppercase, muted text)
  - Rows showing key-value:
    - "Min Confirmations": value from config
    - "RSI Period": value from config
    - "RSI Range": "low–high" (e.g., "30–70")
    - "Stoch Period": value from config
    - "SMA Fast/Slow": "fast/slow" (e.g., "9/21")
    - "BB Period/Std": "period/stdDev" (e.g., "20/2")

- **Values Section**
  - Label: "Values" (uppercase, muted text)
  - Indicator rows (each with label and value):
    - SMA: number or "--"
    - EMA: number or "--"
    - RSI: number with color signal
      - Green (text-green-500) if RSI < 30 (oversold/bullish)
      - Red (text-red-500) if RSI > 70 (overbought/bearish)
    - BB Range: "lower–upper" or "--"
    - Stoch: number or "--"
    - MACD: number or "--"
    - ATR: number or "--"

#### Card: Signal Status
- **When no position & no result**: "Waiting for signal..." (muted text)
- **When position open**: 
  - Background: green-500/10 (call) or red-500/10 (put)
  - Border: green-500/30 or red-500/30
  - Text: "CALL ACTIVE" or "PUT ACTIVE" (bold, colored)
  - Countdown timer (e.g., "45s")
  - Progress bar (width based on time left)

- **When result available**:
  - Background: green-500/10 or red-500/10
  - Text: "WIN" or "LOSE" (bold, colored)
  - Subtext: price change percentage

#### Card: Results
- Stats grid (3 columns):
  - WIN box: green background, large number, "WIN" label
  - LOSE box: red background, large number, "LOSE" label
  - RATE box: muted background, percentage, "RATE" label

- Recent Signals list:
  - Each row: signal type UPPERCASE + status
  - Colors: green-500 (call/verified win), red-500 (put/verified loss), muted (pending)

#### Card: Log
- Monospaced text log entries
- Each entry: time + message
- Colors: green-500 (call), red-500 (put), green-400 (success), red-400 (error), default (info)

### Main Content (Right Side)

#### Card: Chart
- Header: "Chart — {symbol} ({granularity}s)"
- SmartCharts chart component
- Height: 45vh / 400px minimum 250px

---

## Tab 2: STRATEGY

### Layout
```
Grid: [2 columns on desktop]
```

#### Card: Strategy
- **Strategy Selector** (Dropdown)
  - Options with same mapping as above
  - Label: "Strategy"

#### Card: Indicators (Configuration)
- Toggle switches for each indicator:
  - RSI: toggle + period/high/low inputs (3-column grid when enabled)
  - Stochastic: toggle + period input
  - MACD: toggle only
  - SMA: toggle only
  - Bollinger Bands: toggle only

- Input fields for strategy parameters (3-column grid):
  - Min Confirmations
  - SMA Fast
  - SMA Slow
  - BB Period
  - BB StdDev

- **Export/Import Buttons** (2 buttons side by side)
  - "Export JSON" button
  - "Import JSON" button (triggers hidden file input)

---

## Tab 3: ANALYSIS

### Layout
Same as TRADE tab [340px sidebar] + [chart]

#### Sidebar

##### Card: Strategy Override
- Same strategy dropdown as STRATEGY tab

##### Card: Backtest
- **Run Backtest button**
  - Disabled when: running OR < 30 candles
  - Text: "Running..." when active, "Run Backtest" when idle

- **Backtest Results** (shown after run):
  - Stats grid (same 3-column layout)
  - Recent signals list (last 20, reversed)
    - Each: colored type (CALL/PUT) + price

##### Card: Indicators (same as TRADE)

##### Card: Current Signal
- If no signal: "Waiting for signal..." or reason text
- If signal: 
  - Green/red background box
  - Text: "CALL" or "PUT" (bold)
  - Trigger indicator in parentheses
  - Reason text below

##### Card: Log (same as TRADE)

#### Main Content
- Chart (same as TRADE)

---

## Strategy Analysis Functions

### Core Types

```typescript
type SignalDirection = 'call' | 'put'
type StrategyId = 'multi-momentum' | 'fast-ema-sma-cross' | 'adaptive-confluence' | 'doji'

interface SignalResult {
  signal: SignalDirection | null
  reason: string
  // Additional strategy-specific properties
}
```

### Strategy: Fast EMA/SMA Cross

```typescript
function analyzeCrossover(candles, { smaPeriod, emaPeriod }) {
  // Uses technicalindicators library crossUp/crossDown
  // Calculates SMA series and EMA series
  // Detects crossover points
  
  // CALL signal: EMA crosses above SMA
  // PUT signal: EMA crosses below SMA
  
  return { signal, reason, sma, ema }
}
```

**Parameters:**
- smaPeriod: default 9
- emaPeriod: default 21

### Strategy: Multi Momentum

```typescript
function analyzeMultiMomentum(candles, { minConfirmations, rsiPeriod, rsiHigh, rsiLow, 
  stochPeriod, smaFast, smaSlow, bbPeriod, bbStdDev, enabled }) {
  // Analyzes multiple indicators in parallel
  
  // RSI: Bullish if < rsiLow, Bearish if > rsiHigh
  // Stochastic: Bullish if K < 20, Bearish if K > 80
  // MACD: Bullish if histogram crosses from negative to positive
  // SMA: Bullish if price > fast > slow, Bearish if price < fast < slow
  // BB: Bullish if price at/near lower band, Bearish if at/near upper band
  
  // Accumulates bullish/bearish counts
  // Signal triggers when count >= minConfirmations
}
```

**Parameters:**
- minConfirmations: default 3
- rsiPeriod: default 7
- rsiHigh: default 70
- rsiLow: default 30
- stochPeriod: default 14
- smaFast: default 9
- smaSlow: default 21
- bbPeriod: default 20
- bbStdDev: default 2
- enabled: object with rsi/stoch/macd/sma/bb booleans

### Strategy: Adaptive Confluence

```typescript
function analyzeAdaptiveConfluence(candles, params, prevMacdHist) {
  // EMA trend: Fast > Slow = bullish, Fast < Slow = bearish
  // RSI regime: 45-70 = bullish, 30-55 = bearish
  // MACD cross: Based on histogram cross
  // BB structure: Position relative to bands
  // Candle strength: Body size > 55% of range
  
  // Accumulates scores
  // Signal triggers when bullish/bearish count >= minScore
}
```

**Parameters:**
- emaFast: 20
- emaSlow: 50
- rsiPeriod: 14
- rsiBullMin: 45, rsiBullMax: 70
- rsiBearMin: 30, rsiBearMax: 55
- macdFast: 12, macdSlow: 26, macdSignal: 9
- bbPeriod: 20, bbStdDev: 2
- minScore: 3
- coolDownCandles: 8

### Strategy: Doji

```typescript
function detectDojiSignal(candle, candles, { rsiPeriod, rsiLow, rsiHigh, useBB, bbPeriod }) {
  // Detects doji candles (small body relative to range)
  // Uses RSI and optional BB for confirmation
  // CALL: doji + RSI oversold + BB support
  // PUT: doji + RSI overbought + BB resistance
}
```

---

## Color Palette

- **Bullish/CALL**: `bg-green-500/10`, `border-green-500/30`, `text-green-500`
- **Bearish/PUT**: `bg-red-500/10`, `border-red-500/30`, `text-red-500`
- **Success/WIN**: `text-green-400`, `bg-green-500/10`
- **Error/LOSE**: `text-red-400`, `bg-red-500/10`
- **Muted**: `text-muted-foreground`, `bg-muted/50`
- **Default text**: `text-foreground`

---

## Text Strings

### Tab Labels
- "TRADE"
- "STRATEGY"
- "ANALYSIS"

### Connection
- "Connected" / "Disconnected"
- "Waiting for data..."

### Signals
- "CALL ACTIVE" / "PUT ACTIVE"
- "WIN" / "LOSE"
- "Pending..."
- "Waiting for signal..."

### Buttons
- "Export JSON"
- "Import JSON"
- "Run Backtest" / "Running..."

### Labels
- "Symbol"
- "Timeframe"
- "Strategy"
- "Indicators"
- "Parameters"
- "Values"
- "Signal Status"
- "Results"
- "Log"
- "Backtest"
- "Current Signal"