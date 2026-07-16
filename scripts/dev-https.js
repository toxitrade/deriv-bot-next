const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SSL_DIR = path.resolve(__dirname, '..');
const PORT = 3000;
const DEV_PORT = 3001;

// Verify certificate exists
const certPath = path.join(SSL_DIR, 'localhost+2.pem');
const keyPath = path.join(SSL_DIR, 'localhost+2-key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('Missing SSL certificates. Run:');
  console.error('  mkcert -install');
  console.error('  mkcert localhost 127.0.0.1 ::1 10.42.0.1 10.42.0.131');
  process.exit(1);
}

// Create HTTPS proxy server
const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${DEV_PORT}`,
  changeOrigin: true,
  ws: true,
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502);
    res.end('Bad Gateway');
  }
});

const httpsServer = https.createServer(
  { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
  (req, res) => proxy.web(req, res)
);

// WebSocket support
httpsServer.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

httpsServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  HTTPS Dev Server: https://10.42.0.131:${PORT}`);
  console.log(`  Proxying to: http://localhost:${DEV_PORT}\n`);
});

// Start Next.js dev server on separate port
const nextProcess = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'dev', '--webpack', '-p', String(DEV_PORT)],
  { cwd: path.resolve(__dirname, '..'), shell: true, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } }
);

nextProcess.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
  httpsServer.close();
  process.exit(1);
});

process.on('SIGINT', () => {
  nextProcess.kill('SIGINT');
  httpsServer.close();
  process.exit(0);
});
