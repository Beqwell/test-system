const cookie = require('cookie');

function authMiddleware(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    let user = null;

    if (cookies.user) {
        try {
            user = JSON.parse(cookies.user);
        } catch (err) {
            console.error('Invalid cookie', err);
        }
    }

    return user;
}

module.exports = authMiddleware;
