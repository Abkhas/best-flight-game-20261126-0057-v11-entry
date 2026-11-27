// serve.ts — serve game/ on localhost:8080 for playtesting EMBERLINE 11.
// Run: node serve.ts — then open http://localhost:8080 in desktop Chrome.
// Add ?shot=01-cover (or 02-cockpit, 03-board, 04-title) to see a staged shot.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'game');
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname)));
    if (!path.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const file = path.endsWith('/') ? join(path, 'index.html') : path;
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

server.listen(8080, () => console.log('EMBERLINE 11 at http://localhost:8080'));
