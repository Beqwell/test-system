const db = require('../utils/db');
const MessageDAO = require('../dao/MessageDAO');
const CourseDAO = require('../dao/CourseDAO');
const authMiddleware = require('../middlewares/authMiddleware');
const renderView = require('../utils/viewRenderer');
const { parse } = require('querystring');

module.exports = (router) => {

    router.get('/messages', async (req, res) => {
        const user = authMiddleware(req);
        if (!user || user.role !== 'student') {
        res.writeHead(302, { Location: '/login' });
        return res.end();
        }

        const messages = await MessageDAO.getAllMessages(user.id);
        renderView(res, 'messages/list.ejs', { messages, username: user.username });
    });

    router.post('/messages/read/:id', async (req, res) => {
        const user = authMiddleware(req);
        if (!user || user.role !== 'student') {
        res.writeHead(403);
        return res.end('Forbidden');
        }

        await MessageDAO.markAsRead(req.params.id, user.id);
        res.writeHead(204);
        res.end();
    });

    router.post('/send-message', (req, res) => {
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

        const { course_id, student_id, content } = parse(body);

        if (!course_id || !content || content.trim() === '') {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing content or course');
            return;
        }

        try {
            const finalStudentId = student_id?.trim() === '' ? null : parseInt(student_id);
            await MessageDAO.createMessage(parseInt(course_id), user.id, content.trim(), finalStudentId);

            res.writeHead(302, { Location: `/course/${course_id}/students` });
            res.end();
        } catch (err) {
            console.error('Error sending message:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
        });
    }); 

    router.get('/course/:id/messages', async (req, res) => {
    const user = authMiddleware(req);
    const courseId = parseInt(req.params.id);

    if (!user || user.role !== 'teacher') {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    const messages = await db.query(`
        SELECT m.*, u.username AS student_name,
        EXISTS (
            SELECT 1 FROM message_reads r
            WHERE r.message_id = m.id AND r.student_id = m.student_id
        ) AS is_read
        FROM messages m
        LEFT JOIN users u ON m.student_id = u.id
        WHERE m.course_id = $1 AND m.teacher_id = $2
        ORDER BY m.created_at DESC
    `, [courseId, user.id]);


    const course = await CourseDAO.getCourseById(courseId);

    renderView(res, 'messages/teacherHistory.ejs', {
        messages: messages.rows,
        username: user.username,
        courseId,
        courseName: course.name
    });
    });

    router.get('/api/unread-count', async (req, res) => {
    const user = authMiddleware(req);
    if (!user || user.role !== 'student') return res.end(JSON.stringify({ count: 0 }));

    const unread = await MessageDAO.getUnreadMessages(user.id);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ count: unread.length }));
    });

    router.get('/api/course/:id/unread-status', async (req, res) => {
    const user = authMiddleware(req);
    const courseId = parseInt(req.params.id);

    if (!user || user.role !== 'teacher') return res.end(JSON.stringify({}));

    const result = await db.query(`
        SELECT m.id, m.content, u.username AS student_name,
        r.read_at IS NOT NULL AS is_read
        FROM messages m
        LEFT JOIN users u ON u.id = m.student_id
        LEFT JOIN message_reads r ON r.message_id = m.id AND r.student_id = m.student_id
        WHERE m.course_id = $1 AND m.teacher_id = $2
        AND m.student_id IS NOT NULL
        ORDER BY m.created_at DESC
    `, [courseId, user.id]);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result.rows));
    });

    router.post('/api/mark-all-read', async (req, res) => {
    const user = authMiddleware(req);
    if (!user || user.role !== 'student') {
        res.writeHead(403);
        return res.end();
    }

    try {
        const allMessages = await MessageDAO.getAllMessages(user.id);

        for (const msg of allMessages) {
        if (!msg.is_read) {
            await MessageDAO.markAsRead(msg.id, user.id);
        }
        }

        res.writeHead(204);
        res.end();
    } catch (err) {
        console.error('Error in mark-all-read:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error marking messages as read');
    }
    });

    router.get('/api/unread-count', async (req, res) => {
    const user = authMiddleware(req);
    if (!user || user.role !== 'student') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ count: 0 }));
    }

    const all = await MessageDAO.getAllMessages(user.id);
    const unread = all.filter(m => !m.is_read);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ count: unread.length }));
    });
    
    router.get('/api/messages-json', async (req, res) => {
    const user = authMiddleware(req);
    if (!user || user.role !== 'student') return res.end('[]');

    const allMessages = await MessageDAO.getAllMessages(user.id);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(allMessages));
    });


};
