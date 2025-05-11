const ejs = require('ejs');
const path = require('path');

function renderView(res, viewPath, data = {}) {
    const fullPath = path.join(__dirname, '..', 'views', viewPath);

    ejs.renderFile(fullPath, data, {}, (err, str) => {
        if (err) {
            console.error('Error rendering view:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error rendering view');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(str);
    });
}

module.exports = renderView;
