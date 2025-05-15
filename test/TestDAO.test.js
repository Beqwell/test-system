const chai = require('chai');
const expect = chai.expect;
const TestDAO = require('../dao/TestDAO');
const CourseDAO = require('../dao/CourseDAO');
const db = require('../utils/db');

describe('TestDAO', () => {
  const teacherId = 1;  // must exist in your database
  const studentId = 1;  // must exist in your database

  let testCourseId;
  let createdTestId;

  // Setup: create a temporary course before running tests
  before(async () => {
    const course = await CourseDAO.createCourse('TEMP_TEST_COURSE', teacherId);
    testCourseId = course.id;
    console.log(`[SETUP] Created test course: ${testCourseId}`);
  });

  // Cleanup: delete created test and course after all tests are done
  after(async () => {
    if (createdTestId) {
      await TestDAO.deleteTest(createdTestId);
      console.log(`[CLEANUP] Deleted test: ${createdTestId}`);
    }
    if (testCourseId) {
      await CourseDAO.deleteCourse(testCourseId);
      console.log(`[CLEANUP] Deleted test course: ${testCourseId}`);
    }
  });

  // Test creation of a new test
  it('should create a new test', async () => {
    const test = await TestDAO.createTest(
      testCourseId,
      'DAO Unit Test',
      true,
      null,
      null,
      30,
      2,
      true
    );
    createdTestId = test.id;
    expect(test).to.be.an('object');
    expect(test.title).to.equal('DAO Unit Test');
  });

  // Retrieve the test by its ID
  it('should retrieve test by ID', async () => {
    const test = await TestDAO.getTestById(createdTestId);
    expect(test).to.have.property('id', createdTestId);
    expect(test).to.have.property('title', 'DAO Unit Test');
  });

  // Update the test's fields and check them
  it('should update test', async () => {
    await TestDAO.updateTest(
      createdTestId,
      'Updated DAO Test',
      false,
      true,
      null,
      null,
      60,
      3
    );
    const updated = await TestDAO.getTestById(createdTestId);
    expect(updated.title).to.equal('Updated DAO Test');
    expect(updated.is_visible).to.equal(false);
  });

  // Make sure the test becomes visible again
  it('should force test visible', async () => {
    await TestDAO.forceVisibleTest(createdTestId);
    const test = await TestDAO.getTestById(createdTestId);
    expect(test.is_visible).to.equal(true);
  });

  // Retrieve all tests for a specific course
  it('should return tests for course', async () => {
    const tests = await TestDAO.getTestsByCourse(testCourseId);
    expect(tests).to.be.an('array');
  });

  // Return only tests that are currently visible to students
  it('should return visible tests for student', async () => {
    const tests = await TestDAO.getVisibleTestsForStudent(testCourseId);
    expect(tests).to.be.an('array');
  });

  // Count how many times a student has taken this test
  it('should return test attempts count for student', async () => {
    const count = await TestDAO.getAttemptsCount(createdTestId, studentId);
    expect(count).to.be.a('number');
  });

  // Get the last checked result score or null
  it('should return last result percent or null', async () => {
    const score = await TestDAO.getLastResultPercent(createdTestId, studentId);
    expect(score === null || typeof score === 'number').to.be.true;
  });

  // Get all visible tests across all student courses
  it('should return all tests for a student', async () => {
    const tests = await TestDAO.getAllTestsForStudent(studentId);
    expect(tests).to.be.an('array');
  });

  // Calculate average score across all visible tests for a course
  it('should return average score per course', async () => {
    const avg = await TestDAO.getCourseAverageScore(testCourseId, studentId);
    expect(avg).to.be.a('number');
  });

  // Calculate average score for student across all courses
  it('should return average score across all courses', async () => {
    const avg = await TestDAO.getAverageScoreForStudentAllCourses(studentId);
    expect(avg).to.be.a('number');
  });

  // Suggest upcoming or missed tests for the student
  it('should return reminder tests for student', async () => {
    const tests = await TestDAO.getReminderTestsForStudent(studentId, 2);
    expect(tests).to.be.an('array');
  });

  // Return the number of unchecked submissions per test in course
  it('should return unchecked test count map', async () => {
    const map = await TestDAO.getUncheckedCountForTests(testCourseId);
    expect(map).to.be.an('object');
  });

});
