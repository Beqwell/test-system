const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const crypto = require('crypto');
const { parse } = require('querystring');
const renderView = require('../utils/viewRenderer');
const authMiddleware = require('../middlewares/authMiddleware');
const TestDAO = require('../dao/TestDAO');
const ResultDao = require('../dao/ResultDAO');
const db = require('../utils/db');

module.exports = (router) => {
    
    router.get('/course/:courseId/tests', async (req, res) => {
        const user = authMiddleware(req);
    
        if (!user) {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        const courseId = parseInt(req.params.courseId, 10);
        if (isNaN(courseId)) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid course ID');
          return;
        }
        
        try {
            const allTests = await TestDAO.getTestsByCourse(courseId);
            const now = new Date();
    
            if (user.role === 'teacher') {
                const uncheckedMap = await TestDAO.getUncheckedCountForTests(courseId);

                renderView(res, 'tests/list.ejs', {
                    courseId,
                    tests: allTests,
                    uncheckedMap, 
                    backUrl: '/dashboard'
                })
            } else if (user.role === 'student') {
                // Студенту — тільки доступні тести
                const availableTests = allTests.filter(test =>
                    test.is_visible
                );
                
                
                for (let test of availableTests) {
                    const count = await TestDAO.getAttemptsCount(test.id, user.id);
                    test.attempts_made = count;
                    // Скільки ще спроб лишилося
                    test.attempts_left = (test.max_attempts === null || test.max_attempts === 0)
                        ? null
                        : test.max_attempts - count; // Останній % результату (null якщо ще не оцінено)
                    const resultMeta = await ResultDao.getLastResultMeta(test.id, user.id);
                    test.last_score = resultMeta.score_percent;
                    test.is_checked = resultMeta.is_checked;
                }
                
                const averageScore = await TestDAO.getCourseAverageScore(courseId, user.id);

                renderView(res, 'tests/studentTestList.ejs', {
                    tests: availableTests,
                    backUrl: '/dashboard',
                    averageScore
                });

            } else {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Forbidden');
            }
        } catch (err) {
            console.error('Error loading tests:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Get tests by course route

    router.get('/course/:courseId/create-test', (req, res) => {
        const user = authMiddleware(req);
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        const courseId = req.params.courseId;
    
        renderView(res, 'tests/createTest.ejs', { courseId, backUrl: `/course/${courseId}/tests` });
    }); // Get create test form route

    router.post('/course/:courseId/create-test', (req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
    
        req.on('end', async () => {
            const user = authMiddleware(req);
    
            if (!user || user.role !== 'teacher') {
                res.writeHead(302, { Location: '/login' });
                res.end();
                return;
            }
    
            const courseId = req.params.courseId;
            const parsed = parse(body);
    
            const title = parsed.title;
            const requestedVisible = parsed.is_visible === 'on';
            const isVisible = requestedVisible;

            const startTime = parsed.start_time && parsed.start_time !== 'false' && parsed.start_time.trim() !== ''
                ? new Date(parsed.start_time)
                : null;

            const endTime = parsed.end_time && parsed.end_time !== 'false' && parsed.end_time.trim() !== ''
                ? new Date(parsed.end_time)
                : null;


            const timeLimit = parsed.time_limit_minutes ? parseInt(parsed.time_limit_minutes) : null;
            const maxAttempts = parsed.max_attempts ? parseInt(parsed.max_attempts) : null;

    
            if (!title) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Missing test title');
                return;
            }
    
            try {
                console.log('[DEBUG] Parsed start_time =', parsed.start_time);
                console.log('[DEBUG] Parsed end_time   =', parsed.end_time);
                console.log('[DEBUG] Final startTime   =', startTime);
                console.log('[DEBUG] Final endTime     =', endTime);

                const newTest = await TestDAO.createTest(courseId, title, false, startTime, endTime, timeLimit, maxAttempts, requestedVisible );
    
                res.writeHead(302, { Location: `/test/${newTest.id}/add-question` });
                res.end();
            } catch (err) {
                console.error('Error creating test:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        });
    }); // Create test route

    router.get('/test/:testId/edit', async (req, res) => {
        const user = authMiddleware(req);
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        const testId = req.params.testId;
        const test = await TestDAO.getTestById(testId);
    
        if (!test) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Test not found');
            return;
        }
    
        renderView(res, 'tests/editTest.ejs', { test, backUrl: `/course/${test.course_id}/tests` });
    }); // Get edit test form route
    
    router.post('/test/:testId/edit', (req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
    
        req.on('end', async () => {
            const user = authMiddleware(req);
    
            if (!user || user.role !== 'teacher') {
                res.writeHead(302, { Location: '/login' });
                res.end();
                return;
            }
    
            const testId = req.params.testId;
            const parsed = parse(body);
            
            // Отримуємо значення з форми
            const title = parsed.title;
            const isVisible = parsed.is_visible === 'true';
            const showResult = parsed.show_result_to_student === 'on';
            const startTime = parsed.start_time ? new Date(parsed.start_time) : null;
            const endTime = parsed.end_time ? new Date(parsed.end_time) : null;
            const timeLimit = parsed.time_limit_minutes ? parseInt(parsed.time_limit_minutes) : null;
            const maxAttempts = parsed.max_attempts ? parseInt(parsed.max_attempts) : null;
            
    
            try {
                // Оновлення тесту з новими полями
                await TestDAO.updateTest(testId, title, isVisible, showResult, startTime, endTime, timeLimit, maxAttempts);
    
                // Перенаправляємо на сторінку редагування тесту
                res.writeHead(302, { Location: `/test/${testId}/edit` });
                res.end();
            } catch (err) {
                console.error('Error updating test:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        });
    });     // Edit test route

    router.post('/test/:testId/force-visible', async (req, res) => {
        const user = authMiddleware(req);
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        const testId = req.params.testId;
    
        try {
            await TestDAO.forceVisibleTest(testId);
    
            res.writeHead(302, { Location: `/test/${testId}/edit` });
            res.end();
        } catch (err) {
            console.error('Error forcing test visible:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Force test visible route

    router.get('/delete-test/:testId', async (req, res) => {
        const user = authMiddleware(req);
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
    
        const testId = parseInt(req.params.testId, 10);
        if (isNaN(testId)) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid test ID');
            return;
        }
    
        try {
            // Отримуємо тест, щоб дістати course_id
            const test = await TestDAO.getTestById(testId);
            if (!test) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Test not found');
                return;
            }
    
            await TestDAO.deleteTest(testId);
    
            res.writeHead(302, { Location: `/course/${test.course_id}/tests` });
            res.end();
        } catch (err) {
            console.error('Error deleting test:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Delete test route

    router.post('/test/:testId/publish', async (req, res) => {
    const user = authMiddleware(req);
    const testId = req.params.testId;

    if (!user || user.role !== 'teacher') {
        res.writeHead(302, { Location: '/login' });
        return res.end();
    }

    try {
        // робимо тест видимим
        await db.query(`UPDATE tests SET is_visible = true WHERE id = $1`, [testId]);
        res.writeHead(302, { Location: '/dashboard' });
        res.end();
    } catch (err) {
        console.error('Error publishing test:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
    }
});


};
