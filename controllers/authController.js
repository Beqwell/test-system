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
    
    //Login and Register routes

    router.get('/login', (req, res) => {
        renderView(res, 'auth/login.ejs', { error: null });
    
    }); 

    router.post('/login', (req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
    
        req.on('end', async () => {
            const parsed = parse(body);
            const username = parsed.username;
            const password = parsed.password;
    
            if (!username || !password) {
                renderView(res, 'auth/login.ejs', {
                    error: 'Please enter both username and password.'
                });
                return;
            }
    
            try {
                const user = await UserDAO.findUserByUsername(username);
                if (!user) {
                    renderView(res, 'auth/login.ejs', {
                        error: 'User not found.'
                    });
                    return;
                }
    
                const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
                if (user.password !== hashedPassword) {
                    renderView(res, 'auth/login.ejs', {
                        error: 'Incorrect password.'
                    });
                    return;
                }
    
                // Успішний логін
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
                console.error('Error logging in user:', err);
                renderView(res, 'auth/login.ejs', {
                    error: 'Server error. Please try again.'
                });
            }
        });
    });

    router.get('/register', (req, res) => {
        renderView(res, 'auth/register.ejs', { error: null });
    });

    router.post('/register', (req, res) => {
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
                renderView(res, 'auth/register.ejs', {
                    error: 'All fields are required.'
                });
                return;
            }
    
            try {
                const existingUser = await UserDAO.findUserByUsername(username);
                if (existingUser) {
                    renderView(res, 'auth/register.ejs', {
                        error: 'User already exists.'
                    });
                    return;
                }
    
                const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
                await UserDAO.createUser(username, hashedPassword, role);
    
                res.writeHead(302, { Location: '/login' });
                res.end();
            } catch (err) {
                console.error('Error registering user:', err);
                renderView(res, 'auth/register.ejs', {
                    error: 'Server error. Please try again.'
                });
            }
        });
    });

    router.get('/logout', (req, res) => {
        res.writeHead(302, {
            'Set-Cookie': 'user=; HttpOnly; Max-Age=0',
            'Location': '/login'
        });
        res.end();
    });


};
