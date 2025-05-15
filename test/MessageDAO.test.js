const chai = require('chai');
const expect = chai.expect;

const MessageDAO = require('../dao/MessageDAO');
const CourseDAO = require('../dao/CourseDAO');
const db = require('../utils/db');

describe('MessageDAO', () => {
  const teacherId = 1;
  const studentId = 1;

  let courseId;
  let groupMessageId;
  let personalMessageId;

  // Create temporary course before tests
  before(async () => {
    const course = await CourseDAO.createCourse('TEMP_MSG_COURSE', teacherId);
    courseId = course.id;

    // Also ensure student is in course
    await db.query('INSERT INTO students_courses (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [studentId, courseId]);
  });

  // Clean up messages and course
  after(async () => {
    await db.query('DELETE FROM message_reads WHERE student_id = $1', [studentId]);
    await db.query('DELETE FROM messages WHERE course_id = $1', [courseId]);
    await db.query('DELETE FROM students_courses WHERE course_id = $1 AND student_id = $2', [courseId, studentId]);
    await CourseDAO.deleteCourse(courseId);
  });

  // Test message creation
  it('should create a group message', async () => {
    const msg = await MessageDAO.createMessage(courseId, teacherId, 'Group message content');
    groupMessageId = msg.id;
    expect(msg).to.be.an('object');
    expect(msg.content).to.equal('Group message content');
  });

  it('should create a personal message', async () => {
    const msg = await MessageDAO.createMessage(courseId, teacherId, 'Private message', studentId);
    personalMessageId = msg.id;
    expect(msg.student_id).to.equal(studentId);
  });

  // Get unread messages
  it('should return unread messages for student', async () => {
    const unread = await MessageDAO.getUnreadMessages(studentId);
    expect(unread).to.be.an('array');
    const ids = unread.map(m => m.id);
    expect(ids).to.include(personalMessageId);
  });

  // Get all messages (group + personal)
  it('should return all messages for student', async () => {
    const all = await MessageDAO.getAllMessages(studentId);
    expect(all).to.be.an('array');
    expect(all.some(m => m.id === groupMessageId)).to.be.true;
    expect(all.some(m => m.id === personalMessageId)).to.be.true;
  });

  // Mark message as read
  it('should mark a message as read', async () => {
    await MessageDAO.markAsRead(personalMessageId, studentId);
    const unread = await MessageDAO.getUnreadMessages(studentId);
    const ids = unread.map(m => m.id);
    expect(ids).to.not.include(personalMessageId);
  });

  // Teacher view of sent messages
  it('should return messages by teacher and course', async () => {
    const sent = await MessageDAO.getMessagesByTeacherAndCourse(teacherId, courseId);
    expect(sent).to.be.an('array');
    expect(sent.length).to.be.greaterThanOrEqual(2); // group + personal
  });
});
