const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const { IncomingForm } = require('formidable');
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
                        attachment_path: row.attachment_path || null,
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
        const form = new IncomingForm({
        multiples: false,
        maxFileSize: 5 * 1024 * 1024,
        allowEmptyFiles: true,
        minFileSize: 0 // дозволити 0 байт
        });



        form.parse(req, async (err, fields, files) => {
                console.log('[DEBUG] Formidable fields:', fields);
                console.log('[DEBUG] Formidable files:', files);
            const user = authMiddleware(req);

            if (!user || user.role !== 'teacher') {
                res.writeHead(302, { Location: '/login' });
                res.end();
                return;
            }

            if (err) {
                console.error('Form error:', err);
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Invalid form');
                return;
            }

            const testId = req.params.testId;

            const rawText = fields.question_text;
            const questionText = typeof rawText === 'string' ? rawText.trim() : String(rawText || '').trim();

            const rawType = fields.question_type;
            const questionType = typeof rawType === 'string' ? rawType.trim() : String(rawType || '').trim();

            const answerCount = parseInt(fields.answer_count || '0');
            const isTextOrNumber = questionType === 'text' || questionType === 'number';
            const isMultiAnswer = questionType === 'multi';


            let attachmentPath = null;
            let file = null;

            if (files.attachment) {
                file = Array.isArray(files.attachment)
                    ? files.attachment[0]
                    : files.attachment;

                console.log('[DEBUG] Attachment info:', {
                    name: file.originalFilename,
                    size: file.size,
                    type: file.mimetype
                });
            }

           

            try {
                if (
                    file &&
                    file.size > 0 &&
                    file.originalFilename &&
                    file.originalFilename.trim() !== ''
                ) {
                    const ext = path.extname(file.originalFilename).toLowerCase();
                    const mime = file.mimetype;
                    const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
                    const allowedMime = ['image/png', 'image/jpeg', 'application/pdf'];

                    if (!allowed.includes(ext) || !allowedMime.includes(mime)) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Invalid file type');
                        return;
                    }

                    const filename = `question-${Date.now()}${ext}`;
                    console.log('[DEBUG] Uploading file to R2:', file.filepath, 'as', filename);

                    attachmentPath = await uploadToR2(file.filepath, filename);
                }



                // Перевірка правильних відповідей
                let correctCount = 0;
                let correctIndex = -1;

                if (questionType === 'one' || questionType === 'multi') {
                    for (let i = 0; i < answerCount; i++) {
                        if (questionType === 'one') {
                            if (fields.is_correct == i.toString()) {
                                correctIndex = i;
                                correctCount++;
                            }
                        } else if (questionType === 'multi') {
                            if (fields[`is_correct_${i}`]) correctCount++;
                        }
                    }

                    if (questionType === 'one' && correctCount !== 1) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Exactly one answer must be marked correct.');
                        return;
                    }
                }

                // Створення питання
                const question = await TestDAO.createQuestion(testId, questionText, questionType, attachmentPath);

                if (isTextOrNumber) {
                    const rawCorrect = fields.manual_correct_answer;
                    const correctAnswerText = typeof rawCorrect === 'string' ? rawCorrect.trim() : String(rawCorrect || '').trim();

                    if (correctAnswerText !== '') {
                        await TestDAO.createAnswer(question.id, correctAnswerText, true);
                    }
                }

                if (!isTextOrNumber) {
                    for (let i = 0; i < answerCount; i++) {
                        const raw = fields[`answer_text_${i}`];
                        const answerText = typeof raw === 'string' ? raw : String(raw).trim();

                        let isCorrect = false;

                        if (questionType === 'one') {
                            isCorrect = (i === correctIndex);
                        } else if (questionType === 'multi') {
                            isCorrect = fields[`is_correct_${i}`] ? true : false;
                        }

                        if (answerText) {
                            await TestDAO.createAnswer(question.id, answerText, isCorrect);
                        }
                    }
                }

                res.writeHead(302, { Location: `/test/${testId}/add-question` });
                res.end();
            } catch (err) {
                console.error('Error saving question:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        });
    });
    // Add question route

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

    router.post('/test/:testId/publish', async (req, res) => {
        const user = authMiddleware(req);
        const testId = req.params.testId;

        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            return res.end();
        }

        try {
            // Отримати test і перевірити requested_visible
            const test = await TestDAO.getTestById(testId);

            if (!test) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('Test not found');
            }

            // Включаємо is_visible тільки якщо раніше була галочка
            const makeVisible = test.requested_visible === true;

            await db.query(
                `UPDATE tests SET is_visible = $1 WHERE id = $2`,
                [makeVisible, testId]
            );

            res.writeHead(302, { Location: '/dashboard' });
            res.end();
        } catch (err) {
            console.error('Error publishing test:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    });// Publish test route
    
};
