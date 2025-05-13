const db = require('../utils/db');
const crypto = require('crypto');

class CourseDAO {
    static async createCourse(name, teacherId) {
        const joinCode = crypto.randomBytes(3).toString('hex'); 
        const query = 'INSERT INTO courses (name, join_code, teacher_id) VALUES ($1, $2, $3) RETURNING *';
        const values = [name, joinCode, teacherId];
        const { rows } = await db.query(query, values);
        return rows[0];
    }

    static async getCoursesByTeacher(teacherId) {
        const query = 'SELECT * FROM courses WHERE teacher_id = $1';
        const { rows } = await db.query(query, [teacherId]);
        return rows;
    }

    static async getCoursesByStudent(studentId) {
        const query = `
            SELECT c.*, u.username AS teacher_name,
                to_char(c.created_at, 'YYYY-MM-DD HH24:MI') as created_at,
                (SELECT COUNT(*) FROM tests t WHERE t.course_id = c.id) as test_count
            FROM courses c
            JOIN students_courses sc ON c.id = sc.course_id
            JOIN users u ON u.id = c.teacher_id
            WHERE sc.student_id = $1
        `;
        const { rows } = await db.query(query, [studentId]);
        return rows;
    }
    
    

    static async joinCourseByCode(studentId, code) {
        const queryFind = 'SELECT * FROM courses WHERE join_code = $1';
        const { rows } = await db.query(queryFind, [code]);
        const course = rows[0];
        if (!course) {
            throw new Error('Course not found');
        }

        const queryInsert = 'INSERT INTO students_courses (student_id, course_id) VALUES ($1, $2)';
        await db.query(queryInsert, [studentId, course.id]);
    }
    
    static async deleteCourse(courseId) {
        const query = 'DELETE FROM courses WHERE id = $1';
        await db.query(query, [courseId]);
    }
    
    static async getStudentsByCourse(courseId) {
        const query = `
            SELECT u.id, u.username
            FROM users u
            JOIN students_courses sc ON u.id = sc.student_id
            WHERE sc.course_id = $1
        `;
        const { rows } = await db.query(query, [courseId]);
        return rows;
    }
    
    static async removeStudentFromCourse(courseId, studentId) {
        const query = `
            DELETE FROM students_courses
            WHERE course_id = $1 AND student_id = $2
        `;
        await db.query(query, [courseId, studentId]);
    }
 
    static async getAverageScoreForStudentInCourse(courseId, studentId) {
        const query = `
            SELECT AVG(COALESCE(sub.score_percent, 0)) AS avg_score
            FROM (
                SELECT DISTINCT ON (r.test_id) r.score_percent
                FROM results r
                JOIN tests t ON t.id = r.test_id
                WHERE t.course_id = $1
                AND t.is_visible = true
                AND r.student_id = $2
                ORDER BY r.test_id, r.submitted_at DESC
            ) sub
        `;
        const { rows } = await db.query(query, [courseId, studentId]);
        return rows[0].avg_score ? Math.round(rows[0].avg_score) : 0;
    }


    
}




module.exports = CourseDAO;
