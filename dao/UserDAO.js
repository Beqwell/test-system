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
}

module.exports = UserDAO;
