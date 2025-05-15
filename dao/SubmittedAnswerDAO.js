const db = require('../utils/db');

class SubmittedAnswerDAO {

    static async saveSubmittedAnswer(resultId, questionId, answerText, answerId = null, skipDelete = false) {
        if (!skipDelete) {
            await db.query(`
                DELETE FROM answers_submitted
                WHERE result_id = $1 AND question_id = $2
            `, [resultId, questionId]);
        }

        const query = `
            INSERT INTO answers_submitted (result_id, question_id, answer_text, answer_id)
            VALUES ($1, $2, $3, $4)
        `;
        await db.query(query, [resultId, questionId, answerText, answerId]);
    }

    static async evaluateAutoCheckForOne(resultId) {
        const { rows } = await db.query(
            `
            SELECT 
                sa.id           AS submitted_id,
                a.is_correct    AS is_correct
            FROM answers_submitted sa
            JOIN questions q   ON q.id = sa.question_id
            JOIN answers a     ON a.id = sa.answer_id
            WHERE sa.result_id   = $1::int
            AND q.question_type = 'one'
            `,
            [resultId]
        );

        for (const { submitted_id, is_correct } of rows) {
            const percent = is_correct ? 100 : 0;
            await db.query(
                `
                UPDATE answers_submitted
                SET 
                    is_correct_checked = true,
                    accuracy_percent   = $1::int
                WHERE id = $2::int
                `,
                [percent, submitted_id]
            );
        }
    }

    static async evaluateAutoCheckForMulti(resultId, questionId) {
        const correctQuery = `
            SELECT answer_text
            FROM answers
            WHERE question_id = $1 AND is_correct = true
        `;
        const { rows: correctRows } = await db.query(correctQuery, [questionId]);
        const correctAnswers = correctRows.map(r => r.answer_text.trim());

        const studentQuery = `
            SELECT id, answer_text
            FROM answers_submitted
            WHERE result_id = $1 AND question_id = $2
        `;
        const { rows: studentRows } = await db.query(studentQuery, [resultId, questionId]);
        const studentAnswers = studentRows.map(r => r.answer_text.trim());
        const correctSet = new Set(correctAnswers);
        const studentSet = new Set(studentAnswers);
        const allCorrectSelected = correctAnswers.every(a => studentSet.has(a));
        const anyExtraSelected = [...studentSet].some(a => !correctSet.has(a));
        const isCorrect = allCorrectSelected && !anyExtraSelected;

        const percent = isCorrect ? 100 : 0;
        for (const row of studentRows) {
            await db.query(`
                UPDATE answers_submitted
                SET is_correct_checked = true,
                    accuracy_percent     = $1::int
                WHERE id = $2::int
            `, [percent, row.id]);
        }
    }

    static async markAnswerByQuestion(resultId, questionId, accuracyPercent) {
    const pct = Math.max(0, Math.min(parseInt(accuracyPercent, 10), 100));

    // Обновляем сразу все строки за эту пару (result_id, question_id)
    await db.query(`
        UPDATE answers_submitted
        SET 
        is_correct_checked = true,
        accuracy_percent   = $3::int
        WHERE
        result_id   = $1::int
        AND question_id = $2::int
    `, [resultId, questionId, pct]);
    }

    static async markAnswerManually(answerId, accuracyPercent) {
    const pct = Math.max(0, Math.min(parseInt(accuracyPercent, 10), 100));

    console.log('[DAO] markAnswerManually:', { answerId, accuracyPercent });

    const query = `
        UPDATE answers_submitted
        SET 
        is_correct_checked = true,
        accuracy_percent   = $2::int
        WHERE
        answer_id = $1::int   -- для вопросов типа one/multi
        OR id     = $1::int   -- для текстовых и числовых
    `;
    await db.query(query, [answerId, pct]);
    }
    
    static async recalculateResult(resultId) {
        const query = `
            SELECT question_id, accuracy_percent
            FROM answers_submitted
            WHERE result_id = $1 AND is_correct_checked = true
        `;
        const { rows } = await db.query(query, [resultId]);

        const seenQuestions = new Set();
        let total = 0;
        let correctPoints = 0;

        for (const row of rows) {
            const qid = row.question_id;
            if (seenQuestions.has(qid)) continue;
            seenQuestions.add(qid);
            total++;

            const pct = Math.max(0, Math.min(row.accuracy_percent ?? 0, 100));
            correctPoints += pct / 100;
        }

        const percent = total > 0
            ? Math.round((correctPoints / total) * 100)
            : 0;

        const update = `
            UPDATE results
            SET correct_count = $1,
                total_count   = $2,
                score_percent = $3
            WHERE id = $4
        `;
        await db.query(update, [Math.round(correctPoints), total, percent, resultId]);
    }

    static async updateCheckStatus(resultId) {
        const query = `
            SELECT COUNT(*) FILTER (WHERE is_correct_checked IS DISTINCT FROM true) AS unchecked
            FROM answers_submitted
            WHERE result_id = $1
        `;
        const { rows } = await db.query(query, [resultId]);
        const isChecked = parseInt(rows[0].unchecked) === 0;
    
        await db.query(
            `UPDATE results SET is_checked = $1 WHERE id = $2`,
            [isChecked, resultId]
        );
    }

}

module.exports = SubmittedAnswerDAO;