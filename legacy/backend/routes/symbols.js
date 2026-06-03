import { Router } from 'express';

const router = Router();

const availableSymbols = {
  'R_25': { name: 'Jump 25 Index', type: 'index', description: 'Volatility 25 Index' },
  'R_50': { name: 'Jump 50 Index', type: 'index', description: 'Volatility 50 Index' },
  'R_75': { name: 'Jump 75 Index', type: 'index', description: 'Volatility 75 Index' },
  'R_100': { name: 'Jump 100 Index', type: 'index', description: 'Volatility 100 Index' },
  'R_10': { name: 'Jump 10 Index', type: 'index', description: 'Volatility 10 Index' }
};

let symbolsCache = null;
let cacheTime = 0;
const CACHE_TTL = 3600000;

router.get('/', (req, res) => {
  try {
    const now = Date.now();
    
    if (symbolsCache && (now - cacheTime) < CACHE_TTL) {
      return res.json(symbolsCache);
    }
    
    const symbols = Object.keys(availableSymbols).map(key => ({
      symbol: key,
      ...availableSymbols[key]
    }));
    
    symbolsCache = symbols;
    cacheTime = now;
    
    res.json(symbols);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:symbol', (req, res) => {
  try {
    const symbol = availableSymbols[req.params.symbol.toUpperCase()];
    
    if (!symbol) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    
    res.json({ symbol: req.params.symbol.toUpperCase(), ...symbol });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;