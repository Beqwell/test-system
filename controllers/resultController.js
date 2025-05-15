const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const cookie = require('cookie');
const crypto = require('crypto');
const { parse } = require('querystring');
const { renderAttachmentHTML } = require('../utils/viewHelpers');
const db = require('../utils/db');
const TestDAO = require('../dao/TestDAO');
const CourseDAO = require('../dao/CourseDAO');
const QuestionDAO = require('../dao/QuestionDAO');
const SubmittedAnswerDAO = require('../dao/SubmittedAnswerDAO');
const ResultDao = require('../dao/ResultDAO');
const renderView = require('../utils/viewRenderer');
const authMiddleware = require('../middlewares/authMiddleware');


module.exports = (router) => {
    
    router.get('/test/:testId/results', async (req, res) => {
        const user = authMiddleware(req);
        const testId = req.params.testId;
    
        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
            const parsedUrl = url.parse(req.url, true);
            const sortBy = parsedUrl.query.sort_by || 'submitted_at';
    
    
        try {
            const resultsQuery = `
            SELECT r.*, u.username AS student_name, t.title AS test_title, t.course_id
            FROM results r
            JOIN users u ON u.id = r.student_id
            JOIN tests t ON t.id = r.test_id
            WHERE r.test_id = $1
            ORDER BY ${sortBy} DESC
        `;
        
            const { rows: results } = await db.query(resultsQuery, [testId]);
    
            renderView(res, 'tests/results.ejs', {
                testTitle: results[0]?.test_title || 'Test',
                testId,
                results,
                backUrl: `/course/${results[0]?.course_id || ''}/tests`
            });
        } catch (err) {
            console.error('Error loading test results:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Get test results route

    router.get('/result/:resultId', async (req, res) => {
      const user = authMiddleware(req);
      const resultId = parseInt(req.params.resultId, 10);

      if (!user || user.role !== 'teacher') {
        res.writeHead(302, { Location: '/login' });
        res.end();
        return;
      }

      try {
        // 1) Узнаём testId и courseId для backUrl
        const { rows: meta } = await db.query(`
          SELECT r.test_id, t.course_id
          FROM results r
          JOIN tests t ON t.id = r.test_id
          WHERE r.id = $1
        `, [ resultId ]);
        const testId   = meta[0]?.test_id;
        const courseId = meta[0]?.course_id;

        // 2) Получаем уже готовый массив вопросов с вариантами
        const questions = await TestDAO.getDetailedResultFull(resultId);
        const { percent: previewPercent } = await ResultDao.calculateResultPreview(resultId);

        console.log('[Controller] Questions passed to view:', questions);

        // 3) Рендерим
        renderView(res, 'tests/resultDetails.ejs', {
          questions,
          resultId,
          previewPercent,
          backUrl: `/course/${courseId}/tests`,
          renderAttachmentHTML
        });
      } catch (err) {
        console.error('Error loading result detail:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
    }); // Get test result detail route

    router.post('/answer/:answerId/evaluate', (req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        const user = authMiddleware(req);
        if (!user || user.role !== 'teacher') {
          res.writeHead(302, { Location: '/login' });
          return res.end();
        }

        const parsed = parse(body);

        console.log('[DEBUG] Parsed body:', parsed);
        console.log('[DEBUG] Raw body:', body);

        // 1) Извлекаем идентификаторы результата и вопроса
        const resultId   = parseInt(parsed.result_id, 10);
        const questionId = parseInt(parsed.question_id, 10);

        // 2) Сначала — проверяем ручной флаг Correct/Incorrect
        let accuracy = null;
        if ('is_correct' in parsed) {
          accuracy = parsed.is_correct.toLowerCase() === 'true' ? 100 : 0;

        // 3) Если ручного флага нет — смотрим, может быть задан процент
        } else if (parsed.accuracy_percent !== undefined && parsed.accuracy_percent !== '') {
          accuracy = parseInt(parsed.accuracy_percent, 10);
          if (isNaN(accuracy) || accuracy < 0 || accuracy > 100) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            return res.end('Invalid accuracy percent');
          }
        }

        console.log('[DEBUG] Final accuracy:', accuracy);
        if (accuracy === null) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          return res.end('No valid evaluation data provided');
        }

        try {
          // 4) Вызываем новый DAO-метод, который обновляет по (result_id, question_id)
          await SubmittedAnswerDAO.markAnswerByQuestion(resultId, questionId, accuracy);

          // 5) Редирект обратно на страницу детали результата
          res.writeHead(302, { Location: req.headers.referer || '/dashboard' });
          res.end();
        } catch (err) {
          console.error('Error evaluating answer:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error evaluating answer');
        }
      });
    }); // Get test results route

    router.post('/test/:testId/result/:resultId/check', async (req, res) => {
        const user = authMiddleware(req);
    
        // Перевірка, чи авторизований викладач
        if (!user || user.role !== 'teacher') {
            res.writeHead(302, { Location: '/login' });
            res.end();
            return;
        }
    
        const { resultId, testId } = req.params;
    
        try {
            // Позначаємо результат як перевірений
            await ResultDao.markResultChecked(resultId);
    
            // Перераховуємо оцінку після перевірки
            await SubmittedAnswerDAO.recalculateResult(resultId);
    
            // Повертаємо на сторінку результатів
            res.writeHead(302, { Location: `/test/${testId}/results` });
            res.end();
        } catch (err) {
            console.error('Error marking result as checked:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error');
        }
    }); // Check test result route  

    router.post('/result/:resultId/recalculate', async (req, res) => {
    const user = authMiddleware(req);
    const resultId = parseInt(req.params.resultId);

    if (!user || user.role !== 'teacher') {
        res.writeHead(302, { Location: '/login' });
        res.end();
        return;
    }

    try {
        // Отримуємо всі accuracy_percent для цього result
        const query = `
            SELECT accuracy_percent
            FROM answers_submitted
            WHERE result_id = $1
        `;
        const { rows } = await db.query(query, [resultId]);

        const scores = rows.map(r => r.accuracy_percent);
        const allGraded = scores.length > 0 && scores.every(p => p !== null);

        if (!allGraded) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Cannot finalize: some answers are not graded yet.');
            return;
        }

        const sum = scores.reduce((acc, val) => acc + val, 0);
        const average = Math.round(sum / scores.length);

        await db.query(`
            UPDATE results
            SET score_percent = $2,
                is_checked = true
            WHERE id = $1
        `, [resultId, average]);

        res.writeHead(302, { Location: req.headers.referer || `/result/${resultId}` });
        res.end();
    } catch (err) {
        console.error('Error saving final result:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
    }
    });

    
};