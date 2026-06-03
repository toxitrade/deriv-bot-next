import { Router } from 'express';
import configManager from '../config/ConfigManager.js';

const router = Router();

let startTime = Date.now();

router.get('/', (req, res) => {
  try {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const uptime = formatUptime(uptimeSeconds);
    
    res.json({
      status: 'running',
      uptime,
      uptimeSeconds,
      version: '1.0.0',
      config: {
        appId: configManager.get('appId'),
        defaultTimeframe: configManager.get('defaultTimeframe'),
        symbols: configManager.get('symbols')
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/uptime', (req, res) => {
  try {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    res.json({
      uptime: formatUptime(uptimeSeconds),
      uptimeSeconds,
      startTime
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/health', (req, res) => {
  try {
    res.json({ status: 'ok', timestamp: Date.now() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export default router;