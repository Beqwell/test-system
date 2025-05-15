const chai = require('chai');
const expect = chai.expect;
const CourseDAO = require('../dao/CourseDAO');
const db = require('../utils/db');

describe('CourseDAO', () => {

  const teacherId = 1;  // must exist in your DB
  const studentId = 1;  // must exist in your DB

  let createdCourseId;
  let joinCode;

  // Test creating a course
  it('should create a course', async () => {
    const course = await CourseDAO.createCourse('Unit Test Course', teacherId);
    createdCourseId = course.id;
    joinCode = course.join_code;
    expect(course).to.be.an('object');
    expect(course.name).to.equal('Unit Test Course');
  });

  // Get course by ID
  it('should retrieve course by ID', async () => {
    const course = await CourseDAO.getCourseById(createdCourseId);
    expect(course).to.be.an('object');
    expect(course.id).to.equal(createdCourseId);
  });

  // Get courses for teacher
  it('should retrieve courses by teacher ID', async () => {
    const courses = await CourseDAO.getCoursesByTeacher(teacherId);
    expect(courses).to.be.an('array');
    expect(courses.find(c => c.id === createdCourseId)).to.exist;
  });

  // Student joins course by code
  it('should allow student to join the course by code', async () => {
    await CourseDAO.joinCourseByCode(studentId, joinCode);

    const students = await CourseDAO.getStudentsByCourse(createdCourseId);
    expect(students.map(s => s.id)).to.include(studentId);
  });

  // Get courses by student
  it('should retrieve courses for a student', async () => {
    const courses = await CourseDAO.getCoursesByStudent(studentId);
    expect(courses).to.be.an('array');
    expect(courses.some(c => c.id === createdCourseId)).to.be.true;
  });

  // Get average score in course
  it('should return student average score in course', async () => {
    const avg = await CourseDAO.getAverageScoreForStudentInCourse(createdCourseId, studentId);
    expect(avg).to.be.a('number');
  });

  // Remove student from course
  it('should remove student from course', async () => {
    await CourseDAO.removeStudentFromCourse(createdCourseId, studentId);

    const students = await CourseDAO.getStudentsByCourse(createdCourseId);
    expect(students.map(s => s.id)).to.not.include(studentId);
  });

  // Delete course after test
  it('should delete the course', async () => {
    await CourseDAO.deleteCourse(createdCourseId);

    const course = await CourseDAO.getCourseById(createdCourseId);
    expect(course).to.be.undefined;
  });
});
