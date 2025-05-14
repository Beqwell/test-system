const db = require('../utils/db');

class MessageDAO {
    static async createMessage(courseId, teacherId, content, studentId = null) {
        const query = `
        INSERT INTO messages (course_id, teacher_id, content, student_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *`;
        const { rows } = await db.query(query, [courseId, teacherId, content, studentId]);
        return rows[0];
    }

    static async getUnreadMessages(studentId) {
        const query = `
        SELECT m.*, c.name AS course_name, u.username AS teacher_name
        FROM messages m
        JOIN users u ON u.id = m.teacher_id
        JOIN courses c ON c.id = m.course_id
        LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.student_id = $1
        WHERE (m.student_id IS NULL OR m.student_id = $1) AND mr.message_id IS NULL
        ORDER BY m.created_at DESC`;
        const { rows } = await db.query(query, [studentId]);
        return rows;
    }

    static async getAllMessages(studentId) {
    const query = `
        SELECT 
        m.*,
        c.name AS course_name,
        u.username AS teacher_name,
        CASE
            WHEN EXISTS (
            SELECT 1 FROM message_reads mr
            WHERE mr.message_id = m.id AND mr.student_id = $1
            )
            THEN true
            ELSE false
        END AS is_read,
        CASE
            WHEN m.student_id IS NULL THEN 'group'
            ELSE 'personal'
        END AS message_type
        FROM messages m
        JOIN users u ON u.id = m.teacher_id
        JOIN courses c ON c.id = m.course_id
        LEFT JOIN students_courses sc ON sc.course_id = m.course_id AND sc.student_id = $1
        WHERE 
        m.student_id = $1
        OR (
            m.student_id IS NULL AND sc.student_id IS NOT NULL
        )
        ORDER BY m.created_at DESC
    `;
    const { rows } = await db.query(query, [studentId]);
    return rows;
    }


    static async markAsRead(messageId, studentId) {
        const query = `
        INSERT INTO message_reads (message_id, student_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING`;
        await db.query(query, [messageId, studentId]);
    }

    static async getMessagesByTeacherAndCourse(teacherId, courseId) {
    const query = `
        SELECT m.*, u.username AS student_name
        FROM messages m
        LEFT JOIN users u ON m.student_id = u.id
        WHERE m.teacher_id = $1 AND m.course_id = $2
        ORDER BY m.created_at DESC
    `;
    const { rows } = await db.query(query, [teacherId, courseId]);
    return rows;
    }


}


module.exports = MessageDAO;
