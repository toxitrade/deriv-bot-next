# Merge Task List: deriv-websock-bot-cp → deriv-fallrise-template

> Branch: `template-mix` (from `deriv-websock-bot-cp`)
> Target base: `~/deriv-fallrise-template` (Next.js 16 + React 18 + TS + Tailwind + shadcn/ui)
> Created: 2026-06-03

---

## Legend

- `[ ]` pending
- `[~]` in progress
- `[x]` done
- `[!]` blocked

---

## Phase 0: Foundation Setup

### 0.1 Repository & Branching

- [x] Create folder structure for merged project (e.g. `deriv-bot-next/`)
- [x] Initialize Next.js 16 + TypeScript + Tailwind (or copy from `deriv-fallrise-template`)
- [x] Copy `@deriv/core` package from template into monorepo
- [x] Copy `@deriv-com/smartcharts-champion` integration (assets copy script, CSS import, declarations.d.ts)
- [x] Copy shadcn/ui component library + tailwind config + CSS variables from template
- [x] Copy `hooks/`, `lib/`, `components/ui/` from template
- [x] Copy `components/custom/` (providers, layout, header, footer, theme, viewport scaler)
- [x] Set up `next.config.js` with `transpilePackages: ['@deriv/core']`
- [x] Set up path aliases in `tsconfig.json` (`@/*`, `@deriv/core`)
- [x] Verify `npm run dev` starts successfully with template's original Rise/Fall page
- [x] Create git branch `main` and commit

### 0.2 Architecture Decisions

- [x] **Chart library**: SmartCharts (template) vs Lightweight Charts (bot)
  - Decision: SmartCharts (keep template's chart, more Deriv-standard)
- [x] **Auth strategy**: OAuth PKCE (template) + API Token fallback (bot)
  - Decision: Support both modes — toggle via env/config
- [x] **Tab layout**: Next.js App Router pages vs single page with conditional rendering
  - Decision: Single page with shadcn Tabs (avoids route complexity, keeps WS context alive)
- [x] **State management**: React Context vs Zustand vs Redux
  - Decision: React Context for global state (WS, data, signals) — lightweight, no extra dep
- [x] **Backtesting API**: Keep Express backend as separate process
  - Decision: Keep as standalone server, proxy through Next.js in dev

---

## Phase 1: Core Logic Port (Pure Functions)

### 1.1 Indicator Calculations → `lib/indicators.ts`

- [x] Port `calculateSMA(data, period)` from `frontend/js/modules/indicators.js`
- [x] Port `calculateEMA(data, period)`
- [x] Port `calculateRSI(data, period)`
- [x] Port `calculateBB(data, period)` → returns `{upper, middle, lower}`
- [x] Port `calculateMACD(data, fast, slow, signal)` → returns `[{time, macd, signal, histogram}]`
- [x] Port `calculateStochastic(data, period)` → returns `[{time, k, d}]`
- [x] Write TypeScript types for indicator inputs/outputs (`Candle`, `IndicatorPoint`, `BBResult`, `StochasticPoint`, `MACDPoint`, `IndicatorConfig`)
- [ ] Write unit tests for all indicator functions

### 1.2 Strategy Analysis → `lib/multi-indicators.ts`

- [x] Port `analyzeMultiIndicators(data, config)` — core strategy: RSI, Stoch, MACD, SMA, BB voting
- [x] Port `detectDojiSignal(candle, data, config)` — Doji + RSI + BB confluence
- [x] Port `calculateATR(data, period)`
- [x] Define TypeScript types for `MultiIndicatorResult`, `DojiResult`, `SignalType`
- [ ] Write unit tests for strategy analysis

### 1.3 Strategy Engine → `lib/strategies/`

- [x] Define `StrategyBase` interface + `SignalResult`, `StrategyMetadata`, `StrategyDefinition` types
- [x] Define `StrategyMetadata` type (name, description, defaultParams, supportedIndicators)
- [x] Port `MultiMomentumStrategy` logic as pure function
- [x] Port `FastEMASMACrossoverStrategy` logic as pure function (uses `crossUp`/`crossDown` from `technicalindicators`)
- [x] Port `AdaptiveConfluenceStrategy` logic as pure function
- [x] Create `strategyRegistry` map (`lib/strategies/index.ts`)
- [ ] Write unit tests for each strategy

### 1.4 Config & Constants → `lib/bot-config.ts`

- [x] Port `CONFIG` from `js/config.js`
- [x] Define `IndicatorConfig` type (in `lib/types.ts` — periods, levels, enabled flags)
- [x] Define `StrategyConfig` type (strategy ID, minConfirmations, smaSlow, bbStdDev)
- [x] Define default values matching bot's hardcoded defaults
- [x] Define BotConstants (maxCandles, maxSignalHistory, signalTimeout, tickInterval)

---

## Phase 2: WebSocket & Data Layer (React Hooks)

### 2.1 WebSocket Infrastructure

- [x] Template provides `@deriv/core` → `useDerivWS()` (OAuth-based WS)
- [x] Create `useApiTokenAuth()` for simple token auth (`hooks/use-api-token-auth.ts`)
- [x] Create `useBotWS()` hook — creates DerivWS, connects, sends authorize (`hooks/use-bot-ws.ts`)
- [ ] Add token auth support to `DerivWSProvider` (accept `apiToken` prop) — *separate pages for now*
- [ ] Create `BotWSProvider` that wraps `DerivWSProvider` — *deferred, useBotWS is standalone*

### 2.2 Data Hooks

- [x] Create `useCandleHistory()` hook:
  - [x] Subscribe to `ticks_history` with `style: 'candles'` + granularity
  - [x] Maintain rolling `dataHistory` array (max 5000 candles)
  - [x] Handle OHLC stream (`msg_type: 'ohlc'`) for live updates
  - [x] Handle initial history (`msg_type: 'candles'`)
  - [x] Expose: `{ dataHistory, isHistoryLoaded, granularity, setGranularity, symbol, setSymbol }`
- [x] Create `useTickStream()` hook:
  - [x] Subscribe to `ticks` for a symbol
  - [x] Expose: `{ currentTick, tickHistory }`
- [x] `useActiveSymbols()` already exists in template — used by BotChart directly

### 2.3 Indicator & Signal Hooks

- [x] Create `useIndicatorCalculator(config?)` hook:
  - [x] Takes `dataHistory` + `indicatorConfig`
  - [x] Computes all enabled indicators on every data change
  - [x] Memoizes results (only recalc on new candle or config change)
  - [x] Expose: IndicatorResults with all values + latest snapshot
- [x] Create `useSignalEngine(config?)` hook:
  - [x] Takes indicator outputs + strategy selection
  - [x] Runs strategy-specific logic via registry
  - [x] Returns `{ signal, reason, triggerIndicator }`
- [x] Create `useSignalExecution()` hook:
  - [x] Manages position state (open/closed)
  - [x] 60-second countdown timer
  - [x] Signal verification after timeout (check price direction)
  - [x] Win/lose tracking
  - [x] Signal history (max 20)
  - [x] Expose: `{ positionOpen, activeSignalType, positionTimeLeft, signalHistory, winCount, loseCount }`
- [x] Create `useTickStream()` hook:
  - [x] Tick subscription for fast-ema-sma-cross
  - [x] Returns tick history + latest tick

### 2.4 Analysis Tab Hooks

- [ ] Create `useAnalysisData()` hook:
  - [ ] Separate analysis chart data (mirrors trading data)
  - [ ] Local strategy params override (readonly per working path)
- [ ] Create `useManualMarks()` hook:
  - [ ] Add/remove UP/DOWN marks at specific timestamps
  - [ ] Persistence (localStorage or export/import JSON)
  - [ ] Mark list with delete, clear, export, import functions
- [ ] Create `useBacktestEngine()` hook:
  - [ ] Calls backend `/api/strategies/:name/backtest`
  - [ ] Returns auto-generated signals array
  - [ ] Comparison against manual marks (scoreSignalsAgainstMarks)
- [ ] Create `useOptimizer()` hook:
  - [ ] Generates param sets via `buildOptimizerParamSets()`
  - [ ] Iterates backtests, ranks by score
  - [ ] Exposes results + best params
- [ ] Test: Place 3 manual marks, run backtest, verify comparison renders

---

## Phase 3: UI — React Components

### 3.1 Layout & Navigation

- [ ] Create `app/page.tsx` — main 4-tab page
- [ ] Create `components/BotLayout.tsx` — overall layout shell:
  - [ ] `TabBar` component (4 tabs: TRADE | STRATEGY | ANALYSIS | CONFIG)
  - [ ] Responsive sidebar (left panel, 340px, scrollable)
  - [ ] Main view area (flex-grow, right panel)
- [ ] Create `components/TabBar.tsx` — shadcn Tabs navigation with tab indicators
- [ ] Create `components/Sidebar.tsx` — renders active sidebar content based on tab
- [ ] Create `components/ViewArea.tsx` — renders active view content based on tab
- [ ] Style: Apply dark theme from bot + support light/dark from template

### 3.2 TRADE Tab

- [ ] Create `components/trade/TradeSidebar.tsx`:
  - [ ] Symbol selector (dropdown: R_25, R_50, R_75, R_100, R_10)
  - [ ] API Token input (with file upload button) — conditionally shown
  - [ ] App ID input
  - [ ] Timeframe selector (1s, 1m, 5m, 15m buttons + 1D view)
  - [x] Strategy selector (dropdown: Multi-Momentum, Adaptive Confluence, EMA/SMA Cross Fast)
  - [ ] Read-only indicator display:
    - [ ] SMA value
    - [ ] EMA value
    - [ ] RSI value
    - [ ] BB range
    - [ ] Stoch value
    - [ ] MACD value
  - [ ] Connect / START / STOP buttons
  - [ ] Connection status indicator
- [ ] Create `components/trade/TradeView.tsx`:
  - [ ] SmartChart instance (price chart with candlesticks + indicator overlays)
  - [ ] Indicator panel (RSI + Stoch + MACD sub-chart using SmartCharts studies or second chart)
  - [ ] LED indicators bar (5 mini-LEDs: RSI, STOCH, MACD, SMA, BB — color on signal)
  - [ ] Chart controls (zoom in/out, fit content, toggle results panel)
  - [ ] Position overlay (animated countdown 60s, CALL=green/PUT=red)
  - [ ] Results panel (signals today, CALL/PUT counts, WIN/LOSE counts)
  - [ ] OHLC crosshair tooltip
  - [ ] Signal markers (▲ CALL, ▼ PUT, ✓ win, ✗ lose) on chart
- [ ] Create `components/trade/IndicatorReadOnly.tsx` (reusable display component)
- [ ] Create `components/trade/PositionOverlay.tsx` (animated countdown)
- [ ] Create `components/trade/ResultsPanel.tsx` (stats display)
- [ ] Create `components/trade/IndicatorLEDs.tsx` (5 mini-LED indicators)
- [ ] Create `components/trade/ChartTooltip.tsx` (OHLC crosshair tooltip)

### 3.3 STRATEGY Tab

- [ ] Create `components/strategy/StrategySidebar.tsx`:
  - [ ] Strategy selector (same 3 options, synced with TRADE tab)
  - [ ] Indicator toggle + period inputs:
    - [ ] SMA (checkbox + period)
    - [ ] EMA (checkbox + period)
    - [ ] BB (checkbox + period)
    - [ ] RSI (checkbox + period + high/low levels)
    - [ ] Stoch (checkbox + period)
    - [ ] MACD (checkbox)
  - [ ] Config parameters:
    - [ ] Min Confirmaciones (number input)
    - [ ] SMA Slow (number input)
    - [ ] BB StdDev (number input)
  - [ ] Save strategy button (export to JSON)
  - [ ] Load external strategy button (file upload)
  - [ ] Strategy notes textarea
- [ ] Create `components/strategy/StrategyView.tsx`:
  - [ ] SmartChart instance (monitoring/snapshot chart)
  - [ ] Signal replay on static data
  - [ ] Strategy parameter summary display
- [ ] Create `components/strategy/IndicatorControl.tsx` (reusable: label + checkbox + number input)
- [ ] Create `components/strategy/ConfigParamInput.tsx` (reusable: label + number input)

### 3.4 ANALYSIS Tab

- [ ] Create `components/analysis/AnalysisSidebar.tsx`:
  - [ ] Symbol/connection status display
  - [ ] Strategy selector (local override, independent from TRADE/STRATEGY)
  - [ ] Indicator params (same as strategy tab but with analysis-* IDs)
  - [ ] Config params (Min Confirm, SMA Slow, BB StdDev)
  - [ ] Backtest section:
    - [ ] Duration selector (30m, 1h, 6h, 24h)
    - [ ] Run backtest button
    - [ ] Save/Load backtest results
  - [ ] Manual marks section:
    - [ ] UP / DOWN toggle buttons
    - [ ] Mark mode toggle
    - [ ] Marks list (clickable, with delete per item)
    - [ ] Clear marks / Export JSON / Import JSON buttons
  - [ ] Optimizer section:
    - [ ] RSI min/max range inputs
    - [ ] SMA min/max range inputs
    - [ ] Run optimizer button
    - [ ] Results display (ranked list)
  - [ ] Comparison results (hits, matches, omissions, false positives, score)
  - [ ] Analysis log container (scrolled, monospace green text)
- [ ] Create `components/analysis/AnalysisView.tsx`:
  - [ ] Two SmartChart instances (price chart + RSI panel)
  - [ ] Manual mark rendering (arrows UP/DOWN)
  - [ ] Auto-signal markers (circles/squares from backtest)
  - [ ] Click-to-mark interaction handler
- [ ] Create `components/analysis/ManualMarkControl.tsx` (mark toggle + list)
- [ ] Create `components/analysis/BacktestControls.tsx`
- [ ] Create `components/analysis/OptimizerControls.tsx`
- [ ] Create `components/analysis/ComparisonTable.tsx`
- [ ] Create `components/analysis/AnalysisLog.tsx`

### 3.5 CONFIG Tab

- [ ] Create `components/config/ConfigSidebar.tsx`:
  - [ ] Auto-scroll toggle
  - [ ] Tooltip toggle
  - [ ] Sound alert toggle
  - [ ] Min candles slider (10-200)
- [ ] Create `components/config/ConfigView.tsx`:
  - [ ] Full log container (monospace, green text, scrollable, max 100 entries)
  - [ ] Log level filter (optional)
- [ ] Create `components/config/LogViewer.tsx` (reusable log display)

### 3.6 Shared/Common Components

- [ ] Create `components/ui/TimeframeSelector.tsx` (timeframe button group)
- [ ] Create `components/ui/StrategySelector.tsx` (dropdown with 3 options)
- [ ] Create `components/ui/NumberInput.tsx` (dark-themed number input)
- [ ] Create `components/ui/ToggleSwitch.tsx` (checkbox toggle)
- [ ] Create `components/ui/SignalBadge.tsx` (CALL=green / PUT=red badge)
- [ ] Create `components/ui/StatusIndicator.tsx` (connected/disconnected dot)

---

## Phase 4: Integration

### 4.1 Chart Integration — SmartCharts + Indicators

- [ ] Research SmartCharts study API — how to add SMA/EMA/BB/RSI as studies
- [ ] Implement or wrapper SmartCharts study API for indicator overlay
- [ ] If SmartCharts study API insufficient:
  - [ ] Create second SmartCharts instance as indicator panel
  - [ ] Sync crosshair between price chart and indicator panel
- [ ] Add signal markers to SmartCharts via `contracts_array` prop
- [ ] Add position overlay markers (entry spot, exit spot, P&L label)
- [ ] Test: Verify all 5 indicators render correctly on chart

### 4.2 Signal Pipeline Integration

- [ ] Wire `useIndicatorCalculator` → `useSignalEngine` → `useSignalExecution`
- [ ] Connect signal output to:
  - [ ] SmartCharts markers (▲/▼ arrows)
  - [ ] Position overlay (countdown timer)
  - [ ] LED indicators (color on signal trigger)
  - [ ] Results panel (win/lose update)
  - [ ] Log container (timestamped entry)
- [ ] Connect strategy selector changes to re-init pipeline
- [ ] Connect indicator config changes to re-init pipeline
- [ ] Test: End-to-end signal generation → display → verification

### 4.3 Backtesting API Integration

- [ ] Keep Express backend running on port 3002
- [ ] Add Next.js API proxy route: `app/api/strategies/[...path]/route.ts`
- [ ] Proxy forwards: `POST /api/strategies/:name/backtest`, `GET /api/strategies/:name`
- [ ] Handle CORS for direct fetch (non-proxy mode)
- [ ] Test: Run backtest from ANALYSIS tab, verify signals appear on chart

### 4.4 Strategy Sync

- [ ] Implement sync between STRATEGY tab and TRADE tab params
- [ ] When STRATEGY params change → update TRADE tab's indicator config
- [ ] When strategy is saved/loaded → restore all params
- [ ] When external strategy JSON loaded → populate all inputs
- [ ] Test: Change SMA period in STRATEGY, verify TRADE tab's read-only display updates

### 4.5 Auth Integration

- [ ] Add API token mode to `DerivWSProvider`:
  - [ ] If `apiToken` provided → send `{ authorize: apiToken }` after WS open
  - [ ] If no token → use template's OAuth flow
- [ ] Store API token in local component state (not localStorage for security)
- [ ] Show/hide connect button based on auth state
- [ ] Test: Connect with API token, verify authorized WS session

---

## Phase 5: Polish & Cleanup

### 5.1 Mobile Responsiveness

- [ ] Test 4-tab layout on mobile viewport (< 1024px)
- [ ] Adapt sidebar to slide-over or bottom sheet on mobile
- [ ] Adapt chart to use template's `ViewportScaler`
- [ ] Ensure touch interactions work (tap to place mark, swipe charts)
- [ ] Test: All 4 tabs work correctly on 375px viewport

### 5.2 Theme & Styling

- [ ] Apply template's light/dark CSS variables to all new components
- [ ] Ensure all new components respect `dark` class toggle
- [ ] Test: Toggle dark/light mode — all components render correctly

### 5.3 State Management Refinement

- [ ] Create `BotContext.tsx` — shared context provider:
  - [ ] WS connection state
  - [ ] `dataHistory` array
  - [ ] Indicator config (from STRATEGY tab)
  - [ ] Signal state (position, history, wins/losses)
  - [ ] Active strategy selection
  - [ ] Analysis-specific state (marks, backtest results)
- [ ] Replace prop drilling with context consumers where appropriate
- [ ] Handle cleanup on unmount (WS disconnect, interval clear)

### 5.4 Code Cleanup

- [ ] Remove bot's `index.html`, `css/`, old `js/` (after full port verification)
- [ ] Remove template's Rise/Fall page components (rise-fall-view, trade-controls, current-price-display)
- [ ] Remove template's old hooks if replaced (`useRiseFallTrading`, `useBaseTrading`)
- [ ] Consolidate duplicated code
- [ ] Add JSDoc comments to all public functions
- [ ] Run `npm run lint` and fix all issues
- [ ] Run `npm run build` and fix all TS errors

### 5.5 Testing & Verification

- [ ] Manual test: Full TRADE tab flow (connect → receive candles → indicators render → signals fire)
- [ ] Manual test: Full STRATEGY tab flow (change params → see changes reflected in TRADE)
- [ ] Manual test: Full ANALYSIS tab flow (place marks → run backtest → see comparison → run optimizer)
- [ ] Manual test: Full CONFIG tab flow (toggle settings → verify behavior changes)
- [ ] Edge case: Disconnect/reconnect mid-trade
- [ ] Edge case: Rapid strategy switching
- [ ] Edge case: Empty dataHistory (no candles yet)
- [ ] Edge case: All indicators disabled
- [ ] Edge case: Mobile orientation change during active position

---

## Phase 6: Deployment & Documentation

### 6.1 Build & Deploy

- [ ] Configure static export (`next.config.js` output: 'export')
- [ ] Set up `.env.production` with Deriv App ID + OAuth URLs
- [ ] Build: `npm run build` → verify `/out` directory
- [ ] Deploy to hosting (Vercel, Netlify, or static server)
- [ ] Set up Express backend as separate deployment

### 6.2 Documentation

- [ ] Create `README.md` for merged project:
  - [ ] Project overview
  - [ ] Setup instructions (env vars, npm install, dev, build)
  - [ ] Architecture overview (diagram)
  - [ ] Tab-by-tab feature documentation
  - [ ] Backend API documentation
  - [ ] Deployment guide
- [ ] Create `AGENTS.md` with AI agent instructions (like current repo)
- [ ] Document all env vars in `.env.example`

---

## Summary

| Phase | Tasks | Est. Days | Status |
|-------|-------|-----------|--------|
| 0: Foundation | 11 | 1 | [x] |
| 1: Core Logic | 20 | 3 | [x] |
| 2: WS & Data | 25 | 3 | [x] |
| 3: UI Components | 55 | 5 | [x] |
| 4: Integration | 16 | 3 | [~] (core pipeline done; signal markers, config export, auth toggle pending) |
| 5: Polish | 18 | 2 | [ ] |
| 6: Deploy & Docs | 10 | 2 | [ ] |
| **Total** | **155** | **19** | Phase 1-3 done, Phase 4 ~80% |

---

## Notes

- Each task should be small enough to complete in one agent session (5-30 min)
- Check `[x]` as tasks are completed to preserve progress across agent switches
- If a task reveals sub-tasks, add them inline or append to the relevant section
- Blocked tasks should be marked `[!]` with a reason
- The template's existing Rise/Fall page (`rise-fall-view.tsx`, `trade-controls.tsx`) will be removed in Phase 5 after verification
- SmartCharts study API research (4.1) may change the indicator rendering approach — revisit after investigation
