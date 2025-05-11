const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const crypto = require('crypto');
const { parse } = require('querystring');
const renderView = require('../utils/viewRenderer');
const authMiddleware = require('../middlewares/authMiddleware');
const CourseDAO = require('../dao/CourseDAO');

module.exports = (router) => {
    

    router.get('/delete-course/:courseId', async (req, res) => {
        const user = authMiddleware(req);
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
    
        try {
            await CourseDAO.deleteCourse(req.params.courseId);
            res.writeHead(302, { Location: '/dashboard' });
            res.end();
        } catch (err) {
            console.error('Error deleting course:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Delete course route

    router.get('/course/:courseId/students', async (req, res) => {
        const user = authMiddleware(req);
        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        const courseId = parseInt(req.params.courseId, 10);
        const students = await CourseDAO.getStudentsByCourse(courseId);
        renderView(res, 'courses/studentsList.ejs', { students, courseId, backUrl: '/courses'
        });
    }); // List students in course route

    router.post('/course/:courseId/remove-student/:studentId', async (req, res) => {
    const user = authMiddleware(req);
    if (!user || user.role !== 'teacher') {
        res.writeHead(302, { Location: '/login' });
        res.end();
        return;
    }

    const courseId = parseInt(req.params.courseId, 10);
    const studentId = parseInt(req.params.studentId, 10);

    await CourseDAO.removeStudentFromCourse(courseId, studentId);
    res.writeHead(302, { Location: `/course/${courseId}/students` });
    res.end();
}); // Remove student from course route

};
