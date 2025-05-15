const chai = require('chai');
const expect = chai.expect;

const ResultDAO = require('../dao/ResultDAO');
const CourseDAO = require('../dao/CourseDAO');
const TestDAO = require('../dao/TestDAO');
const QuestionDAO = require('../dao/QuestionDAO');
const db = require('../utils/db');

describe('ResultDAO', () => {
  const teacherId = 1;  // must exist
  const studentId = 1;  // must exist

  let courseId;
  let testId;
  let questionId;
  let resultId;

  // Create course, test, question and result before all tests
  before(async () => {
    const course = await CourseDAO.createCourse('TEMP_RESULT_COURSE', teacherId);
    courseId = course.id;

    const test = await TestDAO.createTest(
      courseId,
      'TEMP_RESULT_TEST',
      true,
      null,
      null,
      30,
      2,
      true
    );
    testId = test.id;

    const question = await QuestionDAO.createQuestion(
      testId,
      'What is 2 + 2?',
      'text'
    );
    questionId = question.id;

    // Create result (used in all tests)
    resultId = await ResultDAO.saveResult(testId, studentId, 1, 1, 100, true);

    // Add a submitted answer for preview calculation
    await db.query(`
      INSERT INTO answers_submitted
      (result_id, question_id, answer_text, is_correct_checked, accuracy_percent)
      VALUES ($1, $2, '4', true, 100)
    `, [resultId, questionId]);
  });

  // Clean up all created data
  after(async () => {
    await db.query('DELETE FROM answers_submitted WHERE result_id = $1', [resultId]);
    await db.query('DELETE FROM results WHERE id = $1', [resultId]);
    if (questionId) await QuestionDAO.deleteQuestion(questionId);
    if (testId) await TestDAO.deleteTest(testId);
    if (courseId) await CourseDAO.deleteCourse(courseId);
  });

  // Save new result to database
  it('should save a new result', async () => {
    expect(resultId).to.be.a('number');
  });

  // Update summary of a result
  it('should update result summary', async () => {
    await ResultDAO.updateResultSummary(resultId, 2, 2, 80, true);
    const res = await db.query('SELECT * FROM results WHERE id = $1', [resultId]);
    expect(res.rows[0].correct_count).to.equal(2);
    expect(res.rows[0].score_percent).to.equal(80);
  });

  // Mark result as checked
  it('should mark result as checked', async () => {
    await ResultDAO.markResultChecked(resultId);
    const res = await db.query('SELECT is_checked FROM results WHERE id = $1', [resultId]);
    expect(res.rows[0].is_checked).to.equal(true);
  });

  // Retrieve last result meta info
  it('should get last result meta', async () => {
    const meta = await ResultDAO.getLastResultMeta(testId, studentId);
    expect(meta).to.have.property('score_percent');
    expect(meta).to.have.property('is_checked');
  });

  // Calculate result preview from submitted answers
  it('should calculate result preview (from answers_submitted)', async () => {
    const preview = await ResultDAO.calculateResultPreview(resultId);
    expect(preview).to.have.property('total');
    expect(preview).to.have.property('percent');
    expect(preview.percent).to.equal(100);
  });

  // Retrieve full result data with answers
  it('should get full result with answers', async () => {
    const rows = await ResultDAO.getFullResultWithAnswers(resultId);
    expect(rows).to.be.an('array');
    expect(rows.length).to.be.greaterThan(0);
  });
});
