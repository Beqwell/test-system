const db = require('../utils/db');

class UserDAO {
    static async createUser(username, password, role) {
        const query = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)';
        const values = [username, password, role];

        console.log(`[DAO] Creating user: ${username}, role: ${role}`);
        try {
            await db.query(query, values);
            console.log(`[DAO] User created successfully: ${username}`);
        } catch (err) {
            console.error(`[DAO] Error creating user ${username}:`, err);
            throw err;
        }
    }

    static async findUserByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = $1';

        console.log(`[DAO] Looking for user: ${username}`);
        try {
            const { rows } = await db.query(query, [username]);
            if (rows[0]) {
                console.log(`[DAO] User found: ${username} (id: ${rows[0].id})`);
            } else {
                console.warn(`[DAO] No user found with username: ${username}`);
            }
            return rows[0];
        } catch (err) {
            console.error(`[DAO] Error querying user ${username}:`, err);
            throw err;
        }
    }

    static async getStudentBasicStats(studentId) {
        const query = `
            WITH last_results AS (
                SELECT
                    r.test_id,
                    r.score_percent,
                    r.is_checked
                FROM results r
                WHERE r.student_id = $1
                AND r.id = (
                    SELECT id FROM results r2
                    WHERE r2.student_id = $1 AND r2.test_id = r.test_id
                    ORDER BY r2.submitted_at DESC
                    LIMIT 1
                )
            ), last_scores AS (
                SELECT
                    c.id AS course_id,
                    AVG(ls.last_score) AS avg_score_per_course
                FROM courses c
                JOIN students_courses sc ON sc.course_id = c.id AND sc.student_id = $1
                LEFT JOIN LATERAL (
                    SELECT 
                        t.id AS test_id,
                        COALESCE((
                            SELECT r.score_percent
                            FROM results r
                            WHERE r.test_id = t.id AND r.student_id = $1 AND r.is_checked = true
                            ORDER BY r.submitted_at DESC
                            LIMIT 1
                        ), 0) AS last_score
                    FROM tests t
                    WHERE t.course_id = c.id AND t.is_visible = true
                ) ls ON true
                GROUP BY c.id
            )
            SELECT 
                COALESCE((SELECT COUNT(*) FROM students_courses WHERE student_id = $1), 0) AS courses_joined,
                COALESCE((SELECT COUNT(DISTINCT test_id) FROM results WHERE student_id = $1), 0) AS tests_taken,
                COALESCE((SELECT COUNT(*) FROM last_results WHERE is_checked = true), 0) AS tests_passed,
                COALESCE(ROUND(AVG(avg_score_per_course)::numeric, 2), 0) AS avg_score
            FROM last_scores
        `;
        const { rows } = await db.query(query, [studentId]);
        return rows[0] || {
            courses_joined: 0,
            tests_taken: 0,
            tests_passed: 0,
            avg_score: 0
        };
    }

}

module.exports = UserDAO;
