const db = require('../utils/db');

class TestDAO {
    static async createTest(courseId, title, isVisible, startTime, endTime, timeLimit, maxAttempts) {
        const query = `
            INSERT INTO tests (course_id, title, is_visible, start_time, end_time, time_limit_minutes, max_attempts)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const { rows } = await db.query(query, [
            courseId, title, isVisible, startTime, endTime, timeLimit, maxAttempts
        ]);
        return rows[0];
    }
    

    static async getTestsByCourse(courseId) {
        const query = 'SELECT * FROM tests WHERE course_id = $1';
        const { rows } = await db.query(query, [courseId]);
        return rows;
    }

    static async createAnswer(questionId, answerText, isCorrect) {
        const query = 'INSERT INTO answers (question_id, answer_text, is_correct) VALUES ($1, $2, $3)';
        try {
            await db.query(query, [questionId, answerText, isCorrect]);
        } catch (err) {
            console.error(' ERROR inserting answer:', err);
        }
            }

    static async getQuestionsAndAnswersByTest(testId) {
    const query = `
        SELECT 
            q.id as question_id, 
            q.question_text, 
            q.question_type,
            q.attachment_path,
            a.id as answer_id, 
            a.answer_text, 
            a.is_correct
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id
        WHERE q.test_id = $1
    `;
    const { rows } = await db.query(query, [testId]);
    return rows;
}

    

    static async deleteTest(testId) {
        const query = 'DELETE FROM tests WHERE id = $1';
        await db.query(query, [testId]);
    }

    static async createQuestion(testId, questionText, questionType, attachmentPath = null) {
        const query = `
            INSERT INTO questions (test_id, question_text, question_type, attachment_path)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const { rows } = await db.query(query, [
            testId, questionText, questionType, attachmentPath
        ]);
        return rows[0];
    }

    
    static async getTestById(testId) {
        const query = `
            SELECT id, course_id, title, is_visible, start_time, end_time, time_limit_minutes, max_attempts, show_result_to_student
            FROM tests
            WHERE id = $1
        `;
        const { rows } = await db.query(query, [testId]);
        return rows[0];
    }
    
    
    
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
    }
    
    
    
    static async forceVisibleTest(testId) {
        const query = `
            UPDATE tests
            SET is_visible = true
            WHERE id = $1
        `;
        await db.query(query, [testId]);
    }
    
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
    }
    
    static async saveResult(testId, studentId, correct, total, percent, isChecked) {
        const query = `
            INSERT INTO results (
                test_id, student_id, correct_count, total_count, score_percent, is_checked
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        const { rows } = await db.query(query, [
            testId, studentId, correct, total, percent, isChecked
        ]);
        return rows[0].id;
    }
    
    
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
        console.log('[DAO] Fetched raw rows:', rows);

        const { rows } = await db.query(query, [resultId]);
        return rows;
    }
    
    
    static async recalculateResult(resultId) {
        // Получаем все проверенные ответы (только accuracy_percent)
        const query = `
            SELECT question_id, accuracy_percent
            FROM answers_submitted
            WHERE result_id = $1 AND is_correct_checked = true
        `;
        const { rows } = await db.query(query, [resultId]);

        // Группируем по question_id → берём только по одной записи на вопрос
        const seenQuestions = new Set();
        let total = 0;
        let correctPoints = 0;

        for (const row of rows) {
            const qid = row.question_id;
            if (seenQuestions.has(qid)) continue;
            seenQuestions.add(qid);
            total++;

            // Нормируем процент в диапазон [0,100] и добавляем дробную часть
            const pct = Math.max(0, Math.min(row.accuracy_percent ?? 0, 100));
            correctPoints += pct / 100;
        }

        // Вычисляем итоговый процент
        const percent = total > 0
            ? Math.round((correctPoints / total) * 100)
            : 0;

        // Обновляем результирующую запись
        const update = `
            UPDATE results
            SET correct_count = $1,
                total_count   = $2,
                score_percent = $3
            WHERE id = $4
        `;
        await db.query(update, [correctPoints, total, percent, resultId]);
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

    static async markResultChecked(resultId) {
        const query = `
            UPDATE results
            SET is_checked = true
            WHERE id = $1
        `;
        await db.query(query, [resultId]);
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
    }
    

    static async getDetailedResultFull(resultId) {
    const query = `
        SELECT 
        q.id              AS question_id,
        q.question_text,
        q.question_type,

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


    static async evaluateAutoCheckForMulti(resultId, questionId) {
        // 1) Получаем все правильные варианты текста ответа
        const correctQuery = `
            SELECT answer_text
            FROM answers
            WHERE question_id = $1 AND is_correct = true
        `;
        const { rows: correctRows } = await db.query(correctQuery, [questionId]);
        const correctAnswers = correctRows.map(r => r.answer_text.trim());

        // 2) Получаем все ответы студента на этот вопрос
        const studentQuery = `
            SELECT id, answer_text
            FROM answers_submitted
            WHERE result_id = $1 AND question_id = $2
        `;
        const { rows: studentRows } = await db.query(studentQuery, [resultId, questionId]);
        const studentAnswers = studentRows.map(r => r.answer_text.trim());

        // 3) Считаем, выбрал ли студент все правильные и не выбрал лишнего
        const correctSet = new Set(correctAnswers);
        const studentSet = new Set(studentAnswers);
        const allCorrectSelected = correctAnswers.every(a => studentSet.has(a));
        const anyExtraSelected = [...studentSet].some(a => !correctSet.has(a));
        const isCorrect = allCorrectSelected && !anyExtraSelected;

        // 4) Проставляем checked и accuracy_percent для каждой записи
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

    static async evaluateAutoCheckForOne(resultId) {
        // 1) Получаем все сабмитнутые ответы типа “one” и флаг is_correct
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

        // 2) Для каждой записи вычисляем процент и обновляем двумя параметрами
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

    

  
    
    
    
       
    
    
}

module.exports = TestDAO;
