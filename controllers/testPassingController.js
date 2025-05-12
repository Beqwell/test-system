const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const crypto = require('crypto');
const { parse } = require('querystring');
const TestDAO = require('../dao/TestDAO');
const { renderAttachmentHTML } = require('../utils/viewHelpers');
const db = require('../utils/db');
const CourseDAO = require('../dao/CourseDAO');
const QuestionDAO = require('../dao/QuestionDAO');
const renderView = require('../utils/viewRenderer');
const authMiddleware = require('../middlewares/authMiddleware');


module.exports = (router) => {
   
    router.get('/test/:testId', async (req, res) => {
        const user = authMiddleware(req);
        const testId = req.params.testId;
    
        if (!user) {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }  
    
        try {
            // First, we retrieve the test itself
            const test = await TestDAO.getTestById(testId);
    
            if (!test || !test.is_visible) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Test is not available.');
                return;
            }
    
            const now = new Date();
            if (test.start_time && now < test.start_time) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Test has not started yet.');
                return;
            }
    
            if (test.end_time && now > test.end_time) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Test has expired.');
                return;
            }
    
            const attempts = await TestDAO.getAttemptsCount(testId, user.id);
    
            if (test.max_attempts && attempts >= test.max_attempts) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('You have reached the maximum number of attempts for this test.');
                return;
            } 
            
            // Next, we retrieve the questions and answers
            const rawQuestions = await TestDAO.getQuestionsAndAnswersByTest(testId);
    
            const questionsMap = {};
    
            rawQuestions.forEach(row => {
                if (!questionsMap[row.question_id]) {
                    questionsMap[row.question_id] = {
                        id: row.question_id,
                        text: row.question_text,
                        type: row.question_type,
                        attachment_path: row.attachment_path || null,
                        answers: []
                    };
                }
                if (row.answer_id) {
                    questionsMap[row.question_id].answers.push({
                        id: row.answer_id,
                        text: row.answer_text
                    });
                }
            });
            
    
            const questions = Object.values(questionsMap);
    
            // Retrieve all questions and answers
            renderView(res, 'tests/passTest.ejs', {
                test,
                questions,
                backUrl: `/course/${test.course_id}/tests`,
                renderAttachmentHTML 
            });
    
        } catch (err) {
            console.error('Error loading test for passing:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Get test for passing route

    router.post('/submit-test/:testId', async (req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const user = authMiddleware(req);

            if (!user || (user && user.role !== 'student')) {
                res.writeHead(302, { Location: '/login' });
                res.end();
                return;
            }

            const testId = req.params.testId;
            const parsed = parse(body);
            console.log('Parsed body:', parsed);
            try {
                // Retrieve all questions and answers
                const rawQuestions = await TestDAO.getQuestionsAndAnswersByTest(testId);

                // Forming a structure for validation
                const questionsMap = {};

                rawQuestions.forEach(row => {
                    if (!questionsMap[row.question_id]) {
                        questionsMap[row.question_id] = {
                            type: row.question_type,
                            correctAnswers: [],
                            correctAnswersFull: [] ,
                            correctText: null,
                            correctNumber: null
                        };
                    }

                    if (row.answer_id) {
                        if (row.is_correct) {
                            questionsMap[row.question_id].correctAnswers.push(row.answer_id.toString());

                            questionsMap[row.question_id].correctAnswersFull.push({
                                id: row.answer_id,
                                text: row.answer_text
                              });
                        }
                    } else {
                        // If the question is text or numeric
                        if (row.is_correct && row.answer_text) {
                            if (row.question_type === 'text') {
                                questionsMap[row.question_id].correctText = row.answer_text.trim().toLowerCase();
                            } else if (row.question_type === 'number') {
                                questionsMap[row.question_id].correctNumber = parseFloat(row.answer_text);
                            }
                        }
                    }
                });

                let total = 0;
                let correct = 0;

                // Checking student's answers
                for (const [qId, question] of Object.entries(questionsMap)) {
                    total++;

                    if (question.type === 'one') {
                        const studentAnswer = parsed[`answer_${qId}`];
                        if (studentAnswer && question.correctAnswers.includes(studentAnswer)) {
                            correct++;
                        }
                    } else if (question.type === 'multi') {
                        const studentAnswers = parsed[`answer_${qId}`];
                        if (studentAnswers) {
                            const selected = Array.isArray(studentAnswers) ? studentAnswers : [studentAnswers];
                            if (
                                selected.length === question.correctAnswers.length &&
                                selected.every(ans => question.correctAnswers.includes(ans))
                            ) {
                                correct++;
                            }
                        }
                    } else if (question.type === 'text') {
                        const studentAnswer = parsed[`answer_${qId}`];
                        if (studentAnswer && studentAnswer.trim().toLowerCase() === question.correctText) {
                            correct++;
                        }
                    } else if (question.type === 'number') {
                        const studentAnswer = parsed[`answer_${qId}`];
                        if (studentAnswer && parseFloat(studentAnswer) === question.correctNumber) {
                            correct++;
                        }
                    }
                }

                // Check if any question requires manual check
                const isChecked = Object.values(questionsMap).every(question => {
                    const hasNoCorrect =
                        (question.type === 'one' || question.type === 'multi') &&
                        (!Array.isArray(question.correctAnswers) || question.correctAnswers.length === 0);

                    const hasNoText =
                        question.type === 'text' && (question.correctText === null || question.correctText === undefined);

                    const hasNoNumber =
                        question.type === 'number' && (question.correctNumber === null || isNaN(question.correctNumber));

                    return !(hasNoCorrect || hasNoText || hasNoNumber);
                });

                const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

                const resultId = await TestDAO.saveResult(testId, user.id, correct, total, percent, isChecked);


                for (const qId of Object.keys(questionsMap)) {
                    const field = `answer_${qId}`;
                    const val = parsed[field];
                    const isMulti = questionsMap[qId].type === 'multi';
                
                    const isEmpty =
                        (!val || (Array.isArray(val) && val.length === 0)) &&
                        (!isMulti || !Array.isArray(val)); // multi без жодного вибору
                
                    if (isEmpty) {
                        await TestDAO.saveSubmittedAnswer(resultId, qId, '');
                    }
                }

                // Save answers to the database
                for (const [qId, question] of Object.entries(questionsMap)) {
                    const field = `answer_${qId}`;
                    const val = parsed[field];

                    // Отримуємо всі варіанти відповідей для цього питання
                    const allOptions = rawQuestions
                        .filter(r => r.question_id.toString() === qId.toString())
                        .map(r => ({
                            id: r.answer_id?.toString(),
                            text: r.answer_text
                        }));

                    if (question.type === 'multi') {
                        const allAnswers = Array.isArray(val) ? val : (val ? [val] : []);

                        //  Один раз вручну очищаємо попередні відповіді
                        await db.query(`
                            DELETE FROM answers_submitted
                            WHERE result_id = $1 AND question_id = $2
                        `, [resultId, qId]);

                        //  Додаємо всі вибрані варіанти без повторного DELETE
                        for (const answer of allAnswers) {
                            const match = allOptions.find(a => a.id?.toString() === answer?.toString());
                            const text = match?.text || answer;
                            const answerId = match?.id ? parseInt(match.id) : null;

                            await TestDAO.saveSubmittedAnswer(resultId, qId, text, answerId, true); // ✅ skipDelete = true
                        }

                        // Автоматична перевірка для multi
                        await TestDAO.evaluateAutoCheckForMulti(resultId, qId);
                    }


                    else if (question.type === 'one') {
                        if (val) {
                            const match = allOptions.find(a => a.id?.toString() === val.toString());
                            const text = match?.text || val;
                            const answerId = match?.id ? parseInt(match.id) : null;

                            

                            await TestDAO.saveSubmittedAnswer(resultId, qId, text, answerId);
                        }
                    }

                    else {
                        // text або number
                        if (val) {
                            await TestDAO.saveSubmittedAnswer(resultId, qId, val.trim(), null);
                        }
                    }
                }

                await TestDAO.evaluateAutoCheckForOne(resultId);
                
                // Load the parameter whether to show the result
                const test = await TestDAO.getTestById(testId);

                if (test.show_result_to_student && isChecked) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <h1>Test Completed</h1>
                        <p>You answered correctly ${correct} out of ${total} questions (${percent}%).</p>
                        <br><a href="/dashboard">Back to Dashboard</a>
                    `);
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <h1>Test Submitted</h1>
                        <p>Your result will be available after teacher reviews your answers.</p>
                        <br><a href="/dashboard">Back to Dashboard</a>
                    `);
                }

            } catch (err) {
                console.error('Error submitting test:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        });
    }); // Submit test route

    router.get('/student/all-tests', async (req, res) => {
        const user = authMiddleware(req);
        if (!user || user.role !== 'student') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        try {
            const tests = await TestDAO.getAllTestsForStudent(user.id);
    
            for (let test of tests) {
                const count = await TestDAO.getAttemptsCount(test.id, user.id);
                test.attempts_made = count;
                test.attempts_left = (test.max_attempts === null || test.max_attempts === 0)
                    ? null : test.max_attempts - count;
                test.last_score = await TestDAO.getLastResultPercent(test.id, user.id);
            }
    
            renderView(res, 'tests/allTests.ejs', {
                tests,
                backUrl: '/dashboard'  
            });
        } catch (err) {
            console.error('Error loading all tests:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    });     // Get all tests for student route

};