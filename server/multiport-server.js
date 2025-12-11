const http = require('http');
const next = require('next');

const args = new Set(process.argv.slice(2));
const devExplicit = args.has('--dev');
const prodExplicit = args.has('--prod');
const devMode = devExplicit || (!prodExplicit && process.env.NODE_ENV !== 'production');

process.env.NODE_ENV = devMode ? 'development' : 'production';
const isBackground = args.has('--background');

const parsePorts = () => {
  const envValue = process.env.FRONTEND_PORTS || '';
  const list = envValue
    .split(',')
    .map((p) => parseInt(p.trim(), 10))
    .filter((p) => Number.isInteger(p) && p > 0);
  if (list.length > 0) {
    return list;
  }
  // Default: four ports so that up to four independent browser clients can connect
  return [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007];
};

const ports = parsePorts();
const app = next({ dev: devMode });
const handle = app.getRequestHandler();

const servers = [];

const startServers = async () => {
  try {
    await app.prepare();
    ports.forEach((port) => {
      const server = http.createServer((req, res) => {
        handle(req, res);
      });
      server.on('error', (err) => {
        console.error(`[port] Failed to bind on port ${port}:`, err.message);
        process.exitCode = 1;
      });
      server.listen(port, () => {
        console.log(`[port] Ready on http://localhost:${port} (dev=${devMode})`);
      });
      servers.push(server);
    });
  } catch (err) {
    console.error('[port] Failed to start Next.js application:', err);
    process.exit(1);
  }
};

startServers();

const shutdown = () => {
  console.log('\n[port] Shutting down multi-port server...');
  Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve) => {
          server.close(() => resolve());
        })
    )
  ).finally(() => {
    app.close?.();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
