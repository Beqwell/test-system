const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const crypto = require('crypto');
const { parse } = require('querystring');

const db = require('./utils/db');
const renderView = require('./utils/viewRenderer');

const Router = require('./routes/Router');
const router = new Router();

const PORT = 3000;

// Basic testing system setup
router.get('/', (req, res) => {
    console.log('[ROUTER] GET /');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Welcome to the Testing System!</h1>');
});

router.get('/about', (req, res) => {
    console.log('[ROUTER] GET /about');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>About Page</h1>');
});

// Controller imports
require('./controllers/authController')(router);
require('./controllers/courseController')(router);
require('./controllers/dashboardController')(router);
require('./controllers/testController')(router);
require('./controllers/testPassingController')(router);
require('./controllers/resultController')(router);
require('./controllers/questionController')(router);
require('./controllers/messageController')(router);

// MIME types for static files
const mimeTypes = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Serve static files
const serveStatic = (req, res) => {
    const parsedUrl = url.parse(req.url);
    const safePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, 'public', safePath);
    const ext = path.extname(filePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const mime = mimeTypes[ext] || 'application/octet-stream';
        console.log(`[STATIC] ${req.method} ${req.url} → ${filePath}`);
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
        return true;
    }

    return false;
};

// Start HTTP server
const server = http.createServer((req, res) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);

    if (!serveStatic(req, res)) {
        router.handle(req, res);
    }
});

server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});
