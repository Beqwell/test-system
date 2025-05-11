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
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Welcome to the Testing System!</h1>');
});

router.get('/about', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>About Page</h1>');
});

//  Controller imports
require('./controllers/authController')(router);
require('./controllers/courseController')(router);
require('./controllers/dashboardController')(router); 
require('./controllers/testController')(router);
require('./controllers/testPassingController')(router);
require('./controllers/resultController')(router);
require('./controllers/questionController')(router);

// Start the server
const server = http.createServer((req, res) => {
    router.handle(req, res);
});

server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});
