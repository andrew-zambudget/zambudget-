const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const port = Number(portArgIndex >= 0 ? args[portArgIndex + 1] : process.env.PORT || 4173);
const root = process.cwd();

const mimeTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.gif', 'image/gif'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.webp', 'image/webp']
]);

function resolveRequestPath(requestUrl) {
    const url = new URL(requestUrl, `http://127.0.0.1:${port}`);
    const decodedPath = decodeURIComponent(url.pathname);
    const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(root, normalized);
    const relative = path.relative(root, filePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return null;
    }

    return filePath;
}

const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end('Method Not Allowed');
        return;
    }

    let filePath = resolveRequestPath(req.url);
    if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        if (stat?.isDirectory()) filePath = path.join(filePath, 'index.html');
    } catch {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(error.code === 'ENOENT' ? 404 : 500);
            res.end(error.code === 'ENOENT' ? 'Not Found' : 'Server Error');
            return;
        }

        const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
        });

        if (req.method === 'HEAD') res.end();
        else res.end(content);
    });
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Static test server running at http://127.0.0.1:${port}`);
});
