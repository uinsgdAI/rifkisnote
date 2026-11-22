import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAppRoute,
  buildAppRoutePath,
  evaluateStudentAnswer,
  estimateCambridgeGrade,
  parsePapaCambridgeFilename,
  extractWeakTopicsFromResults,
  findMatchingSyllabusTopics,
} from './examLogic';
import { SYLLABUS_0580, ALL_SUBTOPICS_0580 } from '../data/syllabus0580';
import { PRACTICE_QUESTION_BANK } from '../data/practiceBank';

test('parseAppRoute handles exact notes/0580/1/1.16 and other routes', () => {
  assert.deepEqual(parseAppRoute('/notes/0580/1/1.16'), {
    view: 'notes',
    chapterId: 1,
    topicId: '1.16',
  });
  assert.deepEqual(parseAppRoute('/notes/0580/6/6.5/'), {
    view: 'notes',
    chapterId: 6,
    topicId: '6.5',
  });
  assert.deepEqual(parseAppRoute('/past-papers/0580/2024-may-june'), {
    view: 'past-papers',
    sessionSlug: '2024-may-june',
  });
  assert.deepEqual(parseAppRoute('/practice/0580/mock-extended'), {
    view: 'practice',
    mode: 'mock-extended',
    topicId: undefined,
  });
});

test('buildAppRoutePath serializes routes cleanly', () => {
  assert.equal(
    buildAppRoutePath({ view: 'notes', chapterId: 1, topicId: '1.16' }),
    '/notes/0580/1/1.16'
  );
  assert.equal(
    buildAppRoutePath({ view: 'past-papers', sessionSlug: '2024-may-june' }),
    '/past-papers/0580/2024-may-june'
  );
});

test('evaluateStudentAnswer handles currency, fractions, and numeric tolerances', () => {
  assert.equal(
    evaluateStudentAnswer('$140.22', {
      questionType: 'numeric',
      correctAnswer: '140.22',
      numericAnswer: 140.22,
      tolerance: 0.02,
    }),
    true
  );
  assert.equal(
    evaluateStudentAnswer('4/11', {
      questionType: 'text',
      correctAnswer: '4/11',
      acceptedAnswers: ['4/11'],
      numericAnswer: 4 / 11,
      tolerance: 0.0001,
    }),
    true
  );
  assert.equal(
    evaluateStudentAnswer('0.16', {
      questionType: 'text',
      correctAnswer: '4/25',
      acceptedAnswers: ['4/25', '0.16'],
      numericAnswer: 0.16,
      tolerance: 0.001,
    }),
    true
  );
  assert.equal(
    evaluateStudentAnswer('999', {
      questionType: 'numeric',
      correctAnswer: '140.22',
      numericAnswer: 140.22,
      tolerance: 0.02,
    }),
    false
  );
});

test('estimateCambridgeGrade reflects Extended A*-U and Core C-U tiers', () => {
  assert.equal(estimateCambridgeGrade(90, 100, 'Extended').grade, 'A*');
  assert.equal(estimateCambridgeGrade(75, 100, 'Extended').grade, 'A');
  assert.equal(estimateCambridgeGrade(80, 100, 'Core').grade, 'C');
  assert.equal(estimateCambridgeGrade(10, 100, 'Core').grade, 'U');
});

test('parsePapaCambridgeFilename classifies QP, MS, ER, GT and Core/Extended papers', () => {
  const qp = parsePapaCambridgeFilename(
    '0580_s24_qp_12.pdf',
    'https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/0580_s24_qp_12.pdf',
    '2024-may-june'
  );
  assert.equal(qp.docType, 'QP');
  assert.equal(qp.paperNumber, '1');
  assert.equal(qp.variant, '2');
  assert.equal(qp.tier, 'Core');

  const ms = parsePapaCambridgeFilename(
    '0580_w23_ms_42.pdf',
    'https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload/0580_w23_ms_42.pdf',
    '2023-oct-nov'
  );
  assert.equal(ms.docType, 'MS');
  assert.equal(ms.paperNumber, '4');
  assert.equal(ms.tier, 'Extended');
});

test('All 9 chapters and 72 syllabus subtopics of 0580 have complete study notes', () => {
  assert.equal(SYLLABUS_0580.length, 9);
  assert.equal(ALL_SUBTOPICS_0580.length, 72);

  for (const topic of ALL_SUBTOPICS_0580) {
    assert.ok(topic.title.length > 0, `Missing title on ${topic.id}`);
    assert.ok(topic.bigIdea && topic.bigIdea.length > 20, `Missing bigIdea on ${topic.id}`);
    assert.ok(
      topic.stepByStepMethod && topic.stepByStepMethod.length >= 3,
      `Expected >=3 stepByStepMethod items on ${topic.id}`
    );
    assert.ok(
      topic.comparisonTable &&
        topic.comparisonTable.headers.length >= 2 &&
        topic.comparisonTable.rows.length >= 2,
      `Missing comparisonTable on ${topic.id}`
    );
    assert.ok(
      topic.rapidSummary && topic.rapidSummary.length >= 2,
      `Expected >=2 rapidSummary rows on ${topic.id}`
    );
    assert.ok(topic.coreObjectives.length > 0, `Missing objectives on ${topic.id}`);
    assert.ok(topic.keyFormulas.length > 0, `Missing keyFormulas on ${topic.id}`);
    assert.ok(topic.studyNotes.length >= 2, `Expected >=2 studyNotes sections on ${topic.id}`);
    assert.ok(topic.workedExamples.length >= 2, `Expected >=2 workedExamples on ${topic.id}`);
    assert.ok(topic.quickCheck.prompt.length > 0, `Missing quickCheck on ${topic.id}`);
  }
});

test('Practice bank questions span all 9 chapters', () => {
  const chaptersCovered = new Set(PRACTICE_QUESTION_BANK.map((q) => q.chapterId));
  assert.equal(chaptersCovered.size, 9);
});

test('extractWeakTopicsFromResults groups missed questions by topic ordered by marks lost', () => {
  const weak = extractWeakTopicsFromResults(
    [
      {
        question: { chapterId: 4, topicId: '4.6', topicTitle: 'Angles', marks: 2, sourceRef: '0580/11/M/J/24' },
        isCorrect: false,
        marksEarned: 0,
      },
      {
        question: { chapterId: 9, topicId: '9.7', topicTitle: 'Histograms', marks: 4, sourceRef: '0580/43/O/N/24' },
        isCorrect: false,
        marksEarned: 0,
      },
      {
        question: { chapterId: 1, topicId: '1.16', topicTitle: 'Money', marks: 3, sourceRef: '0580/32/M/J/24' },
        isCorrect: true,
        marksEarned: 3,
      },
    ],
    SYLLABUS_0580
  );

  assert.equal(weak.length, 2);
  assert.equal(weak[0].topicId, '9.7');
  assert.equal(weak[0].marksLost, 4);
  assert.equal(weak[0].chapterTitle, 'Statistics');
  assert.equal(weak[1].topicId, '4.6');
  assert.equal(weak[1].marksLost, 2);
  assert.equal(weak[1].chapterTitle, 'Geometry');
});

test('findMatchingSyllabusTopics maps polygon and statistic queries to exact 0580 notes', () => {
  const polyMatches = findMatchingSyllabusTopics('polygon', SYLLABUS_0580);
  assert.ok(polyMatches.length > 0);
  assert.ok(polyMatches.some((m) => m.topic.id === '4.6'));

  const statMatches = findMatchingSyllabusTopics('Statistic', SYLLABUS_0580);
  assert.ok(statMatches.length >= 5);
  assert.ok(statMatches.every((m) => m.chapterId === 9));
});

