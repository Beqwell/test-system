const chai = require('chai');
const expect = chai.expect;
const UserDAO = require('../dao/UserDAO');
const db = require('../utils/db');

describe('UserDAO', () => {

    const testUsername = 'unit_test_user_' + Date.now();
    const testPassword = 'hashed_test_password';
    const testRole = 'student';

    it('should create a new user', async () => {
        await UserDAO.createUser(testUsername, testPassword, testRole);

        // Verify that the user was created in the database
        const result = await db.query('SELECT * FROM users WHERE username = $1', [testUsername]);
        expect(result.rows.length).to.equal(1);
        expect(result.rows[0].username).to.equal(testUsername);
        expect(result.rows[0].role).to.equal(testRole);
    });

    it('should find user by username', async () => {
        const user = await UserDAO.findUserByUsername(testUsername);
        expect(user).to.be.an('object');
        expect(user.username).to.equal(testUsername);
        expect(user.role).to.equal(testRole);
    });

    it('should return null for non-existent user', async () => {
        const user = await UserDAO.findUserByUsername('definitely_no_such_user');
        expect(user).to.be.undefined; // findUserByUsername returns undefined if not found
    });

});
