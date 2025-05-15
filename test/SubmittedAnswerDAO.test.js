const chai = require('chai');
const expect = chai.expect;

const SubmittedAnswerDAO = require('../dao/SubmittedAnswerDAO');
const CourseDAO = require('../dao/CourseDAO');
const TestDAO = require('../dao/TestDAO');
const QuestionDAO = require('../dao/QuestionDAO');
const ResultDAO = require('../dao/ResultDAO');
const db = require('../utils/db');

describe('SubmittedAnswerDAO', () => {
  const teacherId = 1;
  const studentId = 1;

  let courseId;
  let testId;
  let questionIdOne;
  let questionIdMulti;
  let resultId;

  // Setup course, test, questions, answers, result
  before(async () => {
    const course = await CourseDAO.createCourse('TEMP_SUBMIT_COURSE', teacherId);
    courseId = course.id;

    const test = await TestDAO.createTest(courseId, 'Submit Test', true, null, null, 30, 2, true);
    testId = test.id;

    const q1 = await QuestionDAO.createQuestion(testId, '2 + 2 = ?', 'one');
    const q2 = await QuestionDAO.createQuestion(testId, 'Select all primes', 'multi');
    questionIdOne = q1.id;
    questionIdMulti = q2.id;

    await QuestionDAO.createAnswer(questionIdOne, '4', true);
    await QuestionDAO.createAnswer(questionIdOne, '5', false);

    await QuestionDAO.createAnswer(questionIdMulti, '2', true);
    await QuestionDAO.createAnswer(questionIdMulti, '3', true);
    await QuestionDAO.createAnswer(questionIdMulti, '4', false);

    resultId = await ResultDAO.saveResult(testId, studentId, 0, 0, 0, false);
  });

  after(async () => {
    await db.query('DELETE FROM answers_submitted WHERE result_id = $1', [resultId]);
    await db.query('DELETE FROM results WHERE id = $1', [resultId]);
    await QuestionDAO.deleteQuestion(questionIdOne);
    await QuestionDAO.deleteQuestion(questionIdMulti);
    await TestDAO.deleteTest(testId);
    await CourseDAO.deleteCourse(courseId);
  });

  // Save submitted answer
  it('should save a submitted answer', async () => {
    await SubmittedAnswerDAO.saveSubmittedAnswer(resultId, questionIdOne, '4', null);
    const res = await db.query('SELECT * FROM answers_submitted WHERE result_id = $1', [resultId]);
    expect(res.rows.length).to.be.greaterThan(0);
  });

  // Evaluate single-answer auto check
  it('should auto-check single answer question', async () => {
    const correctAnswer = await db.query(`SELECT id FROM answers WHERE question_id = $1 AND is_correct = true LIMIT 1`, [questionIdOne]);
    const answerId = correctAnswer.rows[0].id;
    await SubmittedAnswerDAO.saveSubmittedAnswer(resultId, questionIdOne, '4', answerId);
    await SubmittedAnswerDAO.evaluateAutoCheckForOne(resultId);
    const check = await db.query('SELECT is_correct_checked, accuracy_percent FROM answers_submitted WHERE result_id = $1', [resultId]);
    expect(check.rows[0].is_correct_checked).to.equal(true);
    expect(check.rows[0].accuracy_percent).to.equal(100);
  });

  // Evaluate multi-answer auto check
  it('should auto-check multiple-answer question', async () => {
    await SubmittedAnswerDAO.saveSubmittedAnswer(resultId, questionIdMulti, '2', null, true);
    await SubmittedAnswerDAO.saveSubmittedAnswer(resultId, questionIdMulti, '3', null, true);
    await SubmittedAnswerDAO.evaluateAutoCheckForMulti(resultId, questionIdMulti);
    const res = await db.query('SELECT accuracy_percent FROM answers_submitted WHERE question_id = $1 AND result_id = $2', [questionIdMulti, resultId]);
    expect(res.rows[0].accuracy_percent).to.equal(100);
  });

  // Manual check by question
  it('should allow manual marking by question', async () => {
    await SubmittedAnswerDAO.markAnswerByQuestion(resultId, questionIdOne, 80);
    const res = await db.query('SELECT accuracy_percent FROM answers_submitted WHERE question_id = $1 AND result_id = $2', [questionIdOne, resultId]);
    expect(res.rows[0].accuracy_percent).to.equal(80);
  });

  // Manual check by answer ID
  it('should allow manual marking by answer ID', async () => {
    const { rows } = await db.query('SELECT id FROM answers_submitted WHERE question_id = $1 AND result_id = $2 LIMIT 1', [questionIdMulti, resultId]);
    const id = rows[0].id;
    await SubmittedAnswerDAO.markAnswerManually(id, 50);
    const check = await db.query('SELECT accuracy_percent FROM answers_submitted WHERE id = $1', [id]);
    expect(check.rows[0].accuracy_percent).to.equal(50);
  });

  // Recalculate overall result score
  it('should recalculate result score', async () => {
    await SubmittedAnswerDAO.recalculateResult(resultId);
    const r = await db.query('SELECT score_percent FROM results WHERE id = $1', [resultId]);
    expect(r.rows[0].score_percent).to.be.a('number');
  });

  // Update is_checked status in result
  it('should update result is_checked status', async () => {
    await SubmittedAnswerDAO.updateCheckStatus(resultId);
    const r = await db.query('SELECT is_checked FROM results WHERE id = $1', [resultId]);
    expect(r.rows[0].is_checked).to.equal(true);
  });
});
