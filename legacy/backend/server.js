import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer } from 'http';

import configManager from './config/ConfigManager.js';
import configRoutes from './routes/config.js';
import strategiesRoutes from './routes/strategies.js';
import symbolsRoutes from './routes/symbols.js';
import statusRoutes from './routes/status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..')));

app.use('/api/config', configRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/symbols', symbolsRoutes);
app.use('/api/status', statusRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message });
});

const hostname = process.env.HOSTNAME || configManager.get('server.hostname') || '0.0.0.0';
const port = process.env.PORT || configManager.get('server.port') || 3002;

console.log(`[Backend] Preparing to start server on ${hostname}:${port}`);

const server = createServer(app);

server.listen(port, hostname, () => {
  console.log(`[Backend] Server running at http://${hostname}:${port}/`);
  console.log(`[Backend] Access locally at: http://localhost:${port}/`);
  console.log(`[Backend] Serving static files from: ${path.join(__dirname, '..')}`);
  console.log(`[Backend] API endpoints:`);
  console.log(`[Backend]   GET  /api/config           - Get config`);
  console.log(`[Backend]   POST /api/config           - Update config`);
  console.log(`[Backend]   GET  /api/strategies       - List strategies`);
  console.log(`[Backend]   GET  /api/symbols         - List symbols`);
  console.log(`[Backend]   GET  /api/status        - Server status`);
  
  if (hostname === '0.0.0.0') {
    console.log(`[Backend] For local dashboard access, use: http://localhost:${port}/free-index.html`);
    console.log(`[Backend] Or configure your hosts file to map dashboard.deriv to 127.0.0.1`);
  }
});

server.on('error', (err) => {
  console.error(`[Backend] Server error:`, err);
});

server.on('listening', () => {
  console.log(`[Backend] Server is listening on port ${port}`);
});

export default server;