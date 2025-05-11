const db = require('../utils/db');

class UserDAO {
    static async createUser(username, password, role) {
        const query = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)';
        const values = [username, password, role];
        await db.query(query, values);
    }

    static async findUserByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = $1';
        const { rows } = await db.query(query, [username]);
        return rows[0];
    }
}

module.exports = UserDAO;
