const url = require('url');

class Router {
    constructor() {
        this.routes = {
            GET: [],
            POST: []
        };
    }

    get(path, handler) {
        console.log(`[ROUTER] Registered GET ${path}`);
        this.routes.GET.push({ path, handler });
    }

    post(path, handler) {
        console.log(`[ROUTER] Registered POST ${path}`);
        this.routes.POST.push({ path, handler });
    }

    matchRoute(routes, method, pathname) {
        for (const route of routes[method]) {
            const routeParts = route.path.split('/').filter(Boolean);
            const urlParts = pathname.split('/').filter(Boolean);

            if (routeParts.length !== urlParts.length) continue;

            let params = {};
            let matched = true;

            for (let i = 0; i < routeParts.length; i++) {
                if (routeParts[i].startsWith(':')) {
                    const paramName = routeParts[i].slice(1);
                    params[paramName] = urlParts[i];
                } else if (routeParts[i] !== urlParts[i]) {
                    matched = false;
                    break;
                }
            }

            if (matched) {
                console.log(`[ROUTER] Matched route: ${method} ${pathname} → ${route.path}`);
                return { handler: route.handler, params };
            }
        }

        console.warn(`[ROUTER] No match for ${method} ${pathname}`);
        return null;
    }

    handle(req, res) {
        const method = req.method;
        const pathname = req.url.split('?')[0];

        const result = this.matchRoute(this.routes, method, pathname);

        if (result) {
            req.params = result.params || {};
            try {
                result.handler(req, res);
            } catch (err) {
                console.error(`[ROUTER] Error in handler for ${method} ${pathname}:`, err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found (Routing)');
        }
    }
}

module.exports = Router;
