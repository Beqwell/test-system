const chai = require('chai');
const expect = chai.expect;
const QuestionDAO = require('../dao/QuestionDAO');
const TestDAO = require('../dao/TestDAO');
const CourseDAO = require('../dao/CourseDAO');

describe('QuestionDAO', () => {
  const teacherId = 1;  // must exist
  const studentId = 1;  // optional for this test

  let courseId;
  let testId;
  let questionId;

  // Set up a course and test before questions
  before(async () => {
    const course = await CourseDAO.createCourse('TEMP_QUESTION_COURSE', teacherId);
    courseId = course.id;

    const test = await TestDAO.createTest(
      courseId,
      'TEMP_QUESTION_TEST',
      true,
      null,
      null,
      20,
      1,
      true
    );
    testId = test.id;
  });

  // Clean up test and course after all tests
  after(async () => {
    if (questionId) {
      await QuestionDAO.deleteQuestion(questionId);
    }
    if (testId) {
      await TestDAO.deleteTest(testId);
    }
    if (courseId) {
      await CourseDAO.deleteCourse(courseId);
    }
  });

  // Test question creation
  it('should create a new question for a test', async () => {
    const question = await QuestionDAO.createQuestion(
      testId,
      'What is 2 + 2?',
      'one', // question type: one correct answer
      null
    );
    questionId = question.id;
    expect(question).to.be.an('object');
    expect(question.question_text).to.equal('What is 2 + 2?');
  });

  // Add answer options to the question
  it('should add answer options to the question', async () => {
    await QuestionDAO.createAnswer(questionId, '4', true);
    await QuestionDAO.createAnswer(questionId, '5', false);
    // no assertion here, we'll test result below
  });

  // Get question and answers
  it('should retrieve questions and answers by test ID', async () => {
    const qa = await QuestionDAO.getQuestionsAndAnswersByTest(testId);
    expect(qa).to.be.an('array');
    const questionRows = qa.filter(q => q.question_id === questionId);
    expect(questionRows.length).to.be.greaterThan(0);
    expect(questionRows[0]).to.have.property('answer_text');
  });

  // Get specific question by ID
  it('should retrieve question by ID', async () => {
    const question = await QuestionDAO.getQuestionById(questionId);
    expect(question).to.be.an('object');
    expect(question.id).to.equal(questionId);
  });

  // Delete the question
  it('should delete the question', async () => {
    await QuestionDAO.deleteQuestion(questionId);
    const deleted = await QuestionDAO.getQuestionById(questionId);
    expect(deleted).to.be.undefined;
    questionId = null; // already deleted
  });

});
