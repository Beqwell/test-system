const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const formidable = require('formidable');
const crypto = require('crypto');
const { parse } = require('querystring');
const { uploadToR2 } = require('../utils/r2');
const TestDAO = require('../dao/TestDAO');
const CourseDAO = require('../dao/CourseDAO');
const QuestionDAO = require('../dao/QuestionDAO');
const renderView = require('../utils/viewRenderer');
const authMiddleware = require('../middlewares/authMiddleware');

module.exports = (router) => {
    
    router.get('/test/:testId/add-question', async (req, res) => {
        const user = authMiddleware(req);
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        const testId = req.params.testId;
    
        try {
            const rawQuestions = await TestDAO.getQuestionsAndAnswersByTest(testId);
    
            const questionsMap = {};
    
            rawQuestions.forEach(row => {
                if (!questionsMap[row.question_id]) {
                    questionsMap[row.question_id] = {
                        question_id: row.question_id,
                        question_text: row.question_text,
                        is_multi_answer: row.is_multi_answer,
                        answers: []
                    };
                }
                if (row.answer_id) {
                    questionsMap[row.question_id].answers.push({
                        answer_id: row.answer_id,
                        answer_text: row.answer_text,
                        is_correct: row.is_correct
                    });
                }
            });
    
            const questions = Object.values(questionsMap);
    
            // Ось тут рендеримо addQuestion.ejs і ПЕРЕДАЄМО questions
            renderView(res, 'tests/addQuestion.ejs', { testId, questions, backUrl: `/test/${testId}/edit` });
    
        } catch (err) {
            console.error('Error loading questions:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Get questions for test route

    router.post('/test/:testId/add-question', (req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
    
        req.on('end', async () => {
            const user = authMiddleware(req);
    
            if (!user || user.role !== 'teacher') {
                res.writeHead(302, { Location: '/login' });
                res.end();
                return;
            }
    
            const testId = req.params.testId;
            const parsed = parse(body);
    
            const questionText = parsed.question_text;
            const questionType = parsed.question_type;
            const answerCount = parseInt(parsed.answer_count) || 0;
    
            const isTextOrNumber = questionType === 'text' || questionType === 'number';
            const isMultiAnswer = questionType === 'multi';
    
            try {
                // Валідація — якщо type=one, дозволено тільки 1 правильна
                let correctCount = 0;
                let correctIndex = -1;
    
                if (questionType === 'one' || questionType === 'multi') {
                    for (let i = 0; i < answerCount; i++) {
                        if (questionType === 'one') {
                            if (parsed.is_correct == i.toString()) {
                                correctIndex = i;
                                correctCount++;
                            }
                        } else if (questionType === 'multi') {
                            if (parsed[`is_correct_${i}`]) correctCount++;
                        }
                    }
                
                    if (questionType === 'one' && correctCount !== 1) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Exactly one answer must be marked correct.');
                        return;
                    }
                }
                
                
    
                // Створити питання
                const question = await TestDAO.createQuestion(testId, questionText, questionType);
    
                if (isTextOrNumber) {
                    const correctAnswerText = parsed.manual_correct_answer;
                    if (correctAnswerText && correctAnswerText.trim() !== '') {
    
                          
                        await TestDAO.createAnswer(question.id, correctAnswerText.trim(), true);
                    }
                }
    
                // Якщо text/number — не створюємо відповіді
                if (!isTextOrNumber) {
                    for (let i = 0; i < answerCount; i++) {
                        const answerText = parsed[`answer_text_${i}`];
                        let isCorrect = false;
    
                        if (questionType === 'one') {
                            isCorrect = (i === correctIndex);
                        } else if (questionType === 'multi') {
                            isCorrect = parsed[`is_correct_${i}`] ? true : false;
                        }
    
                        if (answerText) {
                            await TestDAO.createAnswer(question.id, answerText, isCorrect);
                        }
                    }
                }
    
                res.writeHead(302, { Location: `/test/${testId}/add-question` });
                res.end();
            } catch (err) {
                console.error('Error adding question:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        });
    }); // Add question route

    router.get('/delete-question/:questionId', async (req, res) => {
        const user = authMiddleware(req);
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
    
        try {
            //  Дізнаємось test_id перед видаленням
            const question = await QuestionDAO.getQuestionById(req.params.questionId);
            await QuestionDAO.deleteQuestion(req.params.questionId);
    
            //  Переходимо назад на ту ж сторінку тесту
            res.writeHead(302, { Location: `/test/${question.test_id}/add-question` });
            res.end();
        } catch (err) {
            console.error('Error deleting question:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Delete question route

};
