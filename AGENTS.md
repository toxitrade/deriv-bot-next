# Deriv Trading Bot Agent Guide

## Essential Commands
- **Dev server**: `npm run dev` (port 3000)
- **Type-check**: `npx tsc --noEmit`
- **Build**: `npm run build`
- **Push**: `git push origin main`

## Project Structure
- `app/bot/page.tsx` — Bot page with TRADE/STRATEGY/ANALYSIS tabs
- `app/page.tsx` — Original Rise/Fall trading page (OAuth)
- `components/bot/` — Bot UI components
- `hooks/` — React hooks for WS, indicators, signals, execution
- `lib/` — Pure functions: indicators, strategies, types, config
- `lib/strategies/` — Strategy implementations (registry pattern)
- `legacy/` — Original bot source for reference
- `packages/core/` — Deriv monorepo package (@deriv/core)

## Key Architecture
- **Auth**: Bot uses API token (`useBotWS`), Rise/Fall uses OAuth (`DerivWSProvider`)
- **WS Endpoint**: `wss://ws.binaryws.com/websockets/v3?app_id=1089`
- **Indicators**: All calculations in `lib/indicators.ts` (SMA, EMA, RSI, BB, MACD, Stoch)
- **Strategies**: Registered in `lib/strategies/index.ts`, pure functions, no classes
- **Signal flow**: dataHistory → useIndicatorCalculator → useSignalEngine → useSignalExecution
- **Chart**: SmartCharts via `@deriv-com/smartcharts-champion`

## Development Tips
- No build system for bot logic — pure TS/JS, no webpack needed
- Bot page is at `/bot`, Rise/Fall at `/`
- For mobile testing, use browser dev tools responsive mode
- API token can be obtained from Deriv app settings
