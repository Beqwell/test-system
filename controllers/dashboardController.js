const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const crypto = require('crypto');
const { parse } = require('querystring');
const TestDAO = require('../dao/TestDAO');
const CourseDAO = require('../dao/CourseDAO');
const UserDAO = require('../dao/UserDAO');
const MessageDAO = require('../dao/MessageDAO');
const ResultDAO = require('../dao/ResultDAO');
const renderView = require('../utils/viewRenderer');
const authMiddleware = require('../middlewares/authMiddleware');

module.exports = (router) => {

    router.get('/dashboard', async (req, res) => {
        const user = authMiddleware(req);

        if (!user) {   
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }

        if (user.role === 'teacher') {
            const courses = await CourseDAO.getCoursesByTeacher(user.id);
            renderView(res, 'courses/teacherCourses.ejs', {
                username: user.username,
                courses
            });
        } else if (user.role === 'student') {
            const courses = await CourseDAO.getCoursesByStudent(user.id);
            const reminderTests = await TestDAO.getReminderTestsForStudent(user.id, 3); 
            const unreadMessages = await MessageDAO.getUnreadMessages(user.id); 
            const allMessages = await MessageDAO.getAllMessages(user.id);

            renderView(res, 'courses/studentCourses.ejs', {
                username: user.username,
                courses,
                reminderTests,
                allMessages
            });
        } else {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Unknown role');
        }
    }); // Dashboard route

    router.post('/create-course', (req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const user = authMiddleware(req);

            if (!user || user.role !== 'teacher') {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Forbidden');
                return;
            }

            const parsed = parse(body);
            const name = parsed.name;

            if (!name) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Missing course name');
                return;
            }

            try {
                await CourseDAO.createCourse(name, user.id);
                res.writeHead(302, { Location: '/dashboard' });
                res.end();
            } catch (err) {
                console.error('Error creating course:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        });
    }); // Create course route

    router.post('/join-course', (req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const user = authMiddleware(req);

            if (!user || user.role !== 'student') {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Forbidden');
                return;
            }

            const parsed = parse(body);
            const joinCode = parsed.join_code;

            if (!joinCode) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Missing join code');
                return;
            }

            try {
                await CourseDAO.joinCourseByCode(user.id, joinCode);
                res.writeHead(302, { Location: '/dashboard' });
                res.end();
            } catch (err) {
                console.error('Error joining course:', err);
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Invalid join code');
            }
        });
    }); // Join course route

    router.get('/student/info', async (req, res) => {
        const user = authMiddleware(req);
        if (!user || user.role !== 'student') {
            res.writeHead(403).end('Access denied');
            return;
        }

        const [basicStats, lastResults, courseAverages, upcomingTests, courseProgress] = await Promise.all([
            UserDAO.getStudentBasicStats(user.id),
            ResultDAO.getLastResultsForStudent(user.id, 5),
            TestDAO.getAverageScorePerCourse(user.id),
            TestDAO.getUpcomingTests(user.id, 5),
            TestDAO.getCourseTestStats(user.id),
            MessageDAO.getAllMessages(user.id)
        ]);

        const allMessages = await MessageDAO.getAllMessages(user.id);

        renderView(res, 'courses/studentInfo.ejs', {
            username: user.username,
            basicStats,
            lastResults,
            courseAverages,
            upcomingTests,
            courseProgress,
            allMessages
        });
    });// Student info route
    


};
