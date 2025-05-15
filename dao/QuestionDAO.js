const db = require('../utils/db');

class QuestionDAO {
    static async deleteQuestion(questionId) {
        const query = 'DELETE FROM questions WHERE id = $1';
        await db.query(query, [questionId]);
    }

    static async getQuestionById(questionId) {
        const query = 'SELECT * FROM questions WHERE id = $1';
        const { rows } = await db.query(query, [questionId]);
        return rows[0];
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
    
}

module.exports = QuestionDAO;
