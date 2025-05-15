const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const crypto = require('crypto');
const { parse } = require('querystring');
const renderView = require('../utils/viewRenderer');
const UserDAO = require('../dao/UserDAO');

module.exports = (router) => {

    // Login page
    router.get('/login', (req, res) => {
        console.log('[AUTH] GET /login');
        renderView(res, 'auth/login.ejs', { error: null });
    });

    // Login submit
    router.post('/login', (req, res) => {
        console.log('[AUTH] POST /login');
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const parsed = parse(body);
            const username = parsed.username;
            const password = parsed.password;

            if (!username || !password) {
                console.warn('[AUTH] Login failed: Missing credentials');
                renderView(res, 'auth/login.ejs', {
                    error: 'Please enter both username and password.'
                });
                return;
            }

            try {
                const user = await UserDAO.findUserByUsername(username);
                if (!user) {
                    console.warn(`[AUTH] Login failed: User not found (${username})`);
                    renderView(res, 'auth/login.ejs', {
                        error: 'User not found.'
                    });
                    return;
                }

                const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

                if (user.password !== hashedPassword) {
                    console.warn(`[AUTH] Login failed: Incorrect password for user ${username}`);
                    renderView(res, 'auth/login.ejs', {
                        error: 'Incorrect password.'
                    });
                    return;
                }

                // Успішний логін
                console.log(`[AUTH] Login success: ${username} (id: ${user.id}, role: ${user.role})`);

                res.writeHead(302, {
                    'Set-Cookie': `user=${encodeURIComponent(JSON.stringify({
                        id: user.id,
                        username: user.username,
                        role: user.role
                    }))}; HttpOnly`,
                    'Location': '/dashboard'
                });
                res.end();
            } catch (err) {
                console.error('[AUTH] Error logging in user:', err);
                renderView(res, 'auth/login.ejs', {
                    error: 'Server error. Please try again.'
                });
            }
        });
    });

    // Register page
    router.get('/register', (req, res) => {
        console.log('[AUTH] GET /register');
        renderView(res, 'auth/register.ejs', { error: null });
    });

    // Register submit
    router.post('/register', (req, res) => {
        console.log('[AUTH] POST /register');
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const parsed = parse(body);
            const username = parsed.username;
            const password = parsed.password;
            const role = parsed.role;

            if (!username || !password || !role) {
                console.warn('[AUTH] Registration failed: Missing fields');
                renderView(res, 'auth/register.ejs', {
                    error: 'All fields are required.'
                });
                return;
            }

            try {
                const existingUser = await UserDAO.findUserByUsername(username);
                if (existingUser) {
                    console.warn(`[AUTH] Registration failed: User already exists (${username})`);
                    renderView(res, 'auth/register.ejs', {
                        error: 'User already exists.'
                    });
                    return;
                }

                const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

                await UserDAO.createUser(username, hashedPassword, role);

                console.log(`[AUTH] Registration success: ${username} (${role})`);
                res.writeHead(302, { Location: '/login' });
                res.end();
            } catch (err) {
                console.error('[AUTH] Error registering user:', err);
                renderView(res, 'auth/register.ejs', {
                    error: 'Server error. Please try again.'
                });
            }
        });
    });

    // Logout
    router.get('/logout', (req, res) => {
        console.log('[AUTH] GET /logout → user logged out');
        res.writeHead(302, {
            'Set-Cookie': 'user=; HttpOnly; Max-Age=0',
            'Location': '/login'
        });
        res.end();
    });
};
