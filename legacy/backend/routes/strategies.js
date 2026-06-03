import { Router } from 'express';
import strategyRegistry from '../strategies/index.js';
import StrategyEngine from '../strategies/Engine.js';

const router = Router();
const engine = new StrategyEngine();

router.get('/', (req, res) => {
  try {
    const strategies = strategyRegistry.listStrategies();
    res.json(strategies);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Keep static routes before dynamic /:name
router.get('/state', (req, res) => {
  try {
    res.json(engine.getState());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/state/history', (req, res) => {
  try {
    res.json(engine.getHistory());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/state/reset', (req, res) => {
  try {
    engine.reset();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:name', (req, res) => {
  try {
    const metadata = strategyRegistry.getStrategyMetadata(req.params.name);
    if (!metadata) {
      return res.status(404).json({ error: 'Strategy not found' });
    }
    res.json(metadata);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:name/activate', (req, res) => {
  try {
    const { name } = req.params;
    const params = req.body.params || {};

    const result = engine.setStrategy(name, params);
    if (!result.success) {
      return res.status(400).json(result);
    }

    engine.activateStrategy();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:name/params', (req, res) => {
  try {
    const { name } = req.params;
    const params = req.body.params || {};
    const result = engine.updateParams(name, params);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, params });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:name/deactivate', (req, res) => {
  try {
    const result = engine.deactivateStrategy();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:name/backtest', (req, res) => {
  try {
    const { name } = req.params;
    const { candles = [], params = {} } = req.body || {};

    const exists = strategyRegistry.getStrategyMetadata(name);
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }

    const result = engine.runBacktest(name, candles, params);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
