const db = require('../utils/db');

class TestDAO {
    static async createTest(courseId, title, isVisible, startTime, endTime, timeLimit, maxAttempts, requestedVisible) {
        const query = `
            INSERT INTO tests (
                course_id,
                title,
                is_visible,
                start_time,
                end_time,
                time_limit_minutes,
                max_attempts,
                requested_visible
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const { rows } = await db.query(query, [
            courseId,         
            title,            
            isVisible,        
            startTime,        
            endTime,          
            timeLimit,        
            maxAttempts,      
            requestedVisible  
        ]);

        return rows[0];
    } // Create a new test

    static async getTestsByCourse(courseId) {
        const query = 'SELECT * FROM tests WHERE course_id = $1';
        const { rows } = await db.query(query, [courseId]);
        return rows;
    } // Get all tests for a course
    

    static async deleteTest(testId) {
        const query = 'DELETE FROM tests WHERE id = $1';
        await db.query(query, [testId]);
    } // Delete a test by ID
    
    static async getTestById(testId) {
        const query = `
            SELECT id, course_id, title, is_visible, start_time, end_time, time_limit_minutes, max_attempts, show_result_to_student
            FROM tests
            WHERE id = $1
        `;
        const { rows } = await db.query(query, [testId]);
        return rows[0];
    } // Get a test by ID
    
    static async updateTest(testId, title, isVisible, showResult, startTime, endTime, timeLimit, maxAttempts) {
        const query = `
            UPDATE tests
            SET title = $1,
                is_visible = $2,
                show_result_to_student = $3,
                start_time = $4,
                end_time = $5,
                time_limit_minutes = $6,
                max_attempts = $7
            WHERE id = $8
        `;
        await db.query(query, [title, isVisible, showResult, startTime, endTime, timeLimit, maxAttempts, testId]);
    }// Update a test by ID
    
    static async forceVisibleTest(testId) {
        const query = `
            UPDATE tests
            SET is_visible = true
            WHERE id = $1
        `;
        await db.query(query, [testId]);
    } // Force a test to be visible
    
    static async getVisibleTestsForStudent(courseId) {
        const now = new Date();
        const query = `
            SELECT * FROM tests
            WHERE course_id = $1
              AND is_visible = true
              AND (start_time IS NULL OR start_time <= $2)
              AND (end_time IS NULL OR end_time >= $2)
        `;
        const { rows } = await db.query(query, [courseId, now]);
        return rows;
    }// Get all visible tests for a student in a course
    
    static async getAttemptsCount(testId, studentId) {
        const result = await db.query(
            `SELECT COUNT(*) FROM results 
             WHERE test_id = $1 AND student_id = $2`,
            [testId, studentId]
        );
        return parseInt(result.rows[0].count, 10);
    }

    static async getLastResultPercent(testId, studentId) {
        const result = await db.query(
            `SELECT score_percent FROM results 
            WHERE test_id = $1 AND student_id = $2 AND is_checked = true
            ORDER BY submitted_at DESC LIMIT 1`,
            [testId, studentId]
        );
        return result.rows[0]?.score_percent ?? null;
    }
    static async markAnswerChecked(answerId, isCorrect) {
        const query = `
            UPDATE answers_submitted
            SET is_correct_checked = true,
                is_correct = $1
            WHERE id = $2
        `;
        await db.query(query, [isCorrect, answerId]);
    }
    
    static async getAllTestsForStudent(studentId) {
        const query = `
            SELECT t.*, c.name AS course_name
            FROM tests t
            JOIN courses c ON t.course_id = c.id
            JOIN students_courses sc ON sc.course_id = c.id
            WHERE sc.student_id = $1 AND t.is_visible = true
            ORDER BY c.name, t.title
        `;
        const { rows } = await db.query(query, [studentId]);
        return rows;
    }// Get all tests for a student
    

    static async getDetailedResultFull(resultId) {
    const query = `
        SELECT 
        q.id              AS question_id,
        q.question_text,
        q.question_type,
        q.attachment_path,


        a.id              AS answer_id,
        a.answer_text,
        a.is_correct,

        sa.id             AS submitted_id,
        sa.answer_text    AS submitted_text,
        sa.answer_id      AS submitted_answer_id,
        sa.is_correct_checked,
        sa.accuracy_percent,

        (
            SELECT array_agg(saa.answer_id)
            FROM answers_submitted saa
            WHERE saa.result_id = $1 AND saa.question_id = q.id
        ) AS student_selected_ids

        FROM questions q
        LEFT JOIN answers a 
        ON a.question_id = q.id
        LEFT JOIN answers_submitted sa 
        ON sa.question_id = q.id 
        AND sa.result_id   = $1
        WHERE q.id IN (
        SELECT question_id
        FROM answers_submitted
        WHERE result_id = $1
        )
        ORDER BY q.id, a.id
    `;

    const { rows } = await db.query(query, [resultId]);
    const questionsMap = {};

    for (const row of rows) {
        const qid = row.question_id;
        if (!qid) continue;

        if (!questionsMap[qid]) {
        questionsMap[qid] = {
            id: qid,
            question_text: row.question_text,
            question_type: row.question_type,
            attachment_path: row.attachment_path || null,
            // Сохраняем массив всех выбранных answer_id
            student_selected_ids: row.student_selected_ids || [],
            answers: [],
            student_answers: []
        };
        }

        const q = questionsMap[qid];

        // Собираем текст и идентификатор варианта
        const text = (row.answer_text || row.submitted_text || '').trim();
        // Для идентификатора варианта используем answer_id, либо, если нет, submitted_id
        const id = row.answer_id || row.submitted_id;

        // Избегаем дублирования в списке answers
        const alreadyExists = q.answers.some(a => a.id === id && a.text === text);
        if (!alreadyExists && text) {
        q.answers.push({
            id,
            text,
            is_correct: row.is_correct,
            // Помечаем, выбран ли этот вариант студентом
            is_selected: q.student_selected_ids.includes(row.answer_id),
            is_checked: row.is_correct_checked === true,
            accuracy_percent: row.accuracy_percent
        });
        }

        if ((row.question_type === 'text' || row.question_type === 'number') && row.is_correct && row.answer_text) {
            questionsMap[qid].expected_answer = row.answer_text.trim();
        }

        // Для text/number сохраняем сам текст ответа студента
        if ((row.question_type === 'text' || row.question_type === 'number') && row.submitted_text) {
        q.student_answers = [row.submitted_text.trim()];
        }
    }

    return Object.values(questionsMap);
    }

    static async getCourseAverageScore(courseId, studentId) {
        const query = `
            SELECT 
                t.id AS test_id,
                COALESCE((
                    SELECT r.score_percent
                    FROM results r
                    WHERE r.test_id = t.id AND r.student_id = $2 AND r.is_checked = true
                    ORDER BY r.submitted_at DESC
                    LIMIT 1
                ), 0) AS last_score
            FROM tests t
            WHERE t.course_id = $1 AND t.is_visible = true
        `;
        const { rows } = await db.query(query, [courseId, studentId]);
        if (rows.length === 0) return 0;

        const total = rows.length;
        const sum = rows.reduce((acc, r) => acc + (r.last_score || 0), 0);

        return Math.round(sum / total);
    }// Get the average score for a course

    static async getAverageScoreForStudentAllCourses(studentId) {
    const query = `
        SELECT 
            AVG(score_data.last_score) AS avg_score
        FROM (
            SELECT
                t.id AS test_id,
                COALESCE((
                    SELECT r.score_percent
                    FROM results r
                    WHERE r.student_id = $1
                      AND r.test_id = t.id
                      AND r.is_checked = true
                    ORDER BY r.submitted_at DESC
                    LIMIT 1
                ), 0) AS last_score
            FROM tests t
            JOIN courses c ON t.course_id = c.id
            JOIN students_courses sc ON sc.course_id = c.id AND sc.student_id = $1
            WHERE t.is_visible = true
        ) score_data
    `;
    const { rows } = await db.query(query, [studentId]);
    return rows[0].avg_score !== null ? Math.round(rows[0].avg_score) : 0;
    }// Get the average score for a student across all courses

    static async getReminderTestsForStudent(studentId, max = 3) {
        const now = new Date();

        const { rows: upcoming } = await db.query(`
            SELECT t.*, c.name AS course_name
            FROM tests t
            JOIN courses c ON c.id = t.course_id
            JOIN students_courses sc ON sc.course_id = c.id
            WHERE sc.student_id = $1
            AND t.is_visible = true
            AND (t.end_time IS NOT NULL AND t.end_time > NOW())
            AND NOT EXISTS (
                SELECT 1 FROM results r
                WHERE r.test_id = t.id AND r.student_id = $1
            )
            ORDER BY t.end_time ASC
            LIMIT $2
        `, [studentId, max]);

        if (upcoming.length >= max) return upcoming;

        const excludeIds = upcoming.map(t => t.id);

        const { rows: randomFill } = await db.query(`
            SELECT t.*, c.name AS course_name
            FROM tests t
            JOIN courses c ON c.id = t.course_id
            JOIN students_courses sc ON sc.course_id = c.id
            WHERE sc.student_id = $1
            AND t.is_visible = true
            AND (t.end_time IS NULL OR t.end_time > NOW())
            AND NOT EXISTS (
                SELECT 1 FROM results r
                WHERE r.test_id = t.id AND r.student_id = $1
            )
            ${excludeIds.length ? `AND t.id NOT IN (${excludeIds.join(',')})` : ''}
            ORDER BY RANDOM()
            LIMIT $2
        `, [studentId, max - upcoming.length]);

        return [...upcoming, ...randomFill];
    } // Get tests for a student that are not yet completed

    static async getUncheckedCountForTests(courseId) {
    const query = `
        SELECT t.id AS test_id, COUNT(r.id) AS unchecked_count
        FROM tests t
        LEFT JOIN results r ON r.test_id = t.id AND r.is_checked = false
        WHERE t.course_id = $1
        GROUP BY t.id
    `;
    const { rows } = await db.query(query, [courseId]);
    const map = {};
    for (const row of rows) {
        map[row.test_id] = parseInt(row.unchecked_count);
    }
    return map;
    } // Get the count of unchecked tests for a course

    static async getAverageScorePerCourse(studentId) {
        const query = `
            SELECT 
                c.id AS course_id,
                c.name AS course_name,
                u.username AS teacher_name,
                ROUND(AVG(scores.last_score)::numeric, 2) AS avg_score
            FROM courses c
            JOIN users u ON u.id = c.teacher_id
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
            ) scores ON true
            GROUP BY c.id, c.name, u.username
            HAVING COUNT(scores.test_id) > 0
            ORDER BY avg_score DESC
        `;
        const { rows } = await db.query(query, [studentId]);
        return rows;
    }

    static async getUpcomingTests(studentId, limit = 5) {
        const { rows: upcoming } = await db.query(`
            SELECT t.id, t.title, t.start_time, t.end_time, c.name AS course_name
            FROM tests t
            JOIN courses c ON c.id = t.course_id
            JOIN students_courses sc ON sc.course_id = c.id
            WHERE sc.student_id = $1
            AND t.is_visible = true
            AND t.end_time IS NOT NULL AND t.end_time > NOW()
            AND NOT EXISTS (
                SELECT 1 FROM results r
                WHERE r.test_id = t.id AND r.student_id = $1
            )
            ORDER BY t.end_time ASC
            LIMIT $2
        `, [studentId, limit]);

        if (upcoming.length >= limit) return upcoming;

        const excludeIds = upcoming.map(t => t.id);
        const { rows: randomFill } = await db.query(`
            SELECT t.id, t.title, t.start_time, t.end_time, c.name AS course_name
            FROM tests t
            JOIN courses c ON c.id = t.course_id
            JOIN students_courses sc ON sc.course_id = c.id
            WHERE sc.student_id = $1
            AND t.is_visible = true
            AND (t.end_time IS NULL OR t.end_time > NOW())
            AND NOT EXISTS (
                SELECT 1 FROM results r
                WHERE r.test_id = t.id AND r.student_id = $1
            )
            ${excludeIds.length ? `AND t.id NOT IN (${excludeIds.join(',')})` : ''}
            ORDER BY RANDOM()
            LIMIT $2
        `, [studentId, limit - upcoming.length]);

        return [...upcoming, ...randomFill];
    }

    static async getCourseTestStats(studentId) {
        const query = `
            SELECT 
                c.name AS course_name,
                COUNT(DISTINCT t.id) AS total_tests,
                COUNT(DISTINCT r.test_id) AS completed_tests,
                ROUND(
                    CASE WHEN COUNT(DISTINCT t.id) = 0 THEN 0
                        ELSE 100.0 * COUNT(DISTINCT r.test_id) / COUNT(DISTINCT t.id)
                    END, 1
                ) AS completion_percent
            FROM courses c
            JOIN students_courses sc ON sc.course_id = c.id
            LEFT JOIN tests t ON t.course_id = c.id AND t.is_visible = true
            LEFT JOIN results r ON r.test_id = t.id AND r.student_id = $1
            WHERE sc.student_id = $1
            GROUP BY c.name
        `;
        const { rows } = await db.query(query, [studentId]);
        return rows;
    }


 
    
}

module.exports = TestDAO;
