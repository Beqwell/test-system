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
    
}

module.exports = QuestionDAO;
