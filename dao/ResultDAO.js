const db = require('../utils/db');

class ResultDao{

    static async saveResult(testId, studentId, correct, total, percent, isChecked) {
        const query = `
            INSERT INTO results (
                test_id, student_id, correct_count, total_count, score_percent, is_checked, submitted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, now())
            RETURNING id
        `;
        const { rows } = await db.query(query, [
            testId, studentId, correct, total, percent, isChecked
        ]);
        return rows[0].id;
    }

    static async updateResultSummary(resultId, correctCount, totalCount, scorePercent, isChecked) {
    const query = `
        UPDATE results
        SET correct_count = $2,
            total_count   = $3,
            score_percent = $4,
            is_checked    = $5
        WHERE id = $1
    `;
    await db.query(query, [resultId, correctCount, totalCount, scorePercent, isChecked]);
    }    

    static async markResultChecked(resultId) {
        const query = `
            UPDATE results
            SET is_checked = true
            WHERE id = $1
        `;
        await db.query(query, [resultId]);
    }
    
    static async getLastResultMeta(testId, studentId) {
        const query = `
            SELECT score_percent, is_checked
            FROM results
            WHERE test_id = $1 AND student_id = $2
            ORDER BY submitted_at DESC
            LIMIT 1
        `;
        const { rows } = await db.query(query, [testId, studentId]);
        return rows[0] || { score_percent: null, is_checked: false };
    }

    static async calculateResultPreview(resultId) {
    // Собираем все проверенные ответы
    const { rows } = await db.query(`
        SELECT question_id, accuracy_percent
        FROM answers_submitted
        WHERE result_id = $1 AND is_correct_checked = true
    `, [resultId]);

    const seen = new Set();
    let total = 0, correctPoints = 0;
    for (const { question_id, accuracy_percent } of rows) {
        if (seen.has(question_id)) continue;
        seen.add(question_id);
        total++;
        const pct = Math.max(0, Math.min(accuracy_percent || 0, 100));
        correctPoints += pct / 100;
    }

    const percent = total > 0
        ? Math.round((correctPoints / total) * 100)
        : 0;

    return { total, correctPoints, percent };
    }    

    static async getFullResultWithAnswers(resultId) {
        const query = `
            SELECT 
                q.id AS question_id,
                q.question_text,
                q.question_type,
                a.id AS answer_id,
                a.answer_text,
                sa.answer_text AS submitted_text,
                sa.answer_id AS submitted_answer_id,
                sa.is_correct_checked
            FROM questions q
            LEFT JOIN answers a ON a.question_id = q.id
            LEFT JOIN answers_submitted sa ON sa.question_id = q.id AND sa.result_id = $1
            WHERE q.test_id = (
                SELECT test_id FROM results WHERE id = $1
            )
            ORDER BY q.id, a.id
        `;

        const { rows } = await db.query(query, [resultId]);
        console.log('[DAO] Fetched raw rows:', rows);       
        return rows;
    }

    static async getLastResultsForStudent(studentId, limit = 5) {
        const query = `
            SELECT r.score_percent, r.is_checked, t.title
            FROM results r
            JOIN tests t ON r.test_id = t.id
            WHERE r.student_id = $1
            ORDER BY r.submitted_at DESC
            LIMIT $2
        `;
        const { rows } = await db.query(query, [studentId, limit]);
        return rows;
    }
    
    

}

module.exports = ResultDao;