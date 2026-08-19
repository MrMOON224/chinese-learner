const { Client, TablesDB, Query } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const DB_ID = 'learner_db';

const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const AI_KEY = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || (AI_ENDPOINT.includes('openrouter') ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash');

const CORS = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Appwrite-Response-Format',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const SCHEMAS = {
  lesson: `Respond ONLY with valid JSON matching this schema:
{
  "title": "short lesson title",
  "outcome": "one practical sentence the learner can now say",
  "blocks": [
    {"kind": "text", "text": "short teaching text, English ok, keep it brief"},
    {"kind": "vocab", "word": "Chinese characters", "pinyin": "...", "meaning": "english", "example": "Chinese sentence", "example_pinyin": "...", "example_en": "..."},
    {"kind": "pattern", "chinese": "...", "pinyin": "...", "meaning": "english", "note": "one line grammar, keep simple"},
    {"kind": "practice", "prompt": "what to do", "chinese": "target sentence", "pinyin": "...", "hint": "one line hint"}
  ],
  "vocab": [same word objects as blocks of kind vocab, one entry per word taught]
}
Keep the lesson short (5-8 min). 3-6 blocks. Do not overwhelm beginners.`,

  quiz: `Respond ONLY with valid JSON matching this schema:
{
  "questions": [
    {
      "item_type": "vocab" | "pattern" | "listening",
      "question": "question text (use pinyin/english/audio-friendly text)",
      "options": ["3-4 options as strings"],
      "answer": "index of correct option",
      "explanation": "one simple line shown after answering"
    }
  ]
}
Generate exactly 5 questions, mixing recall (given english, pick Chinese / given pinyin, pick meaning) and pattern substitution (fill the gap in 我喜欢____). Base them on known vocabulary only.`,

  conversation: `Respond ONLY with valid JSON matching this schema:
{
  "reply": "Chinese response appropriate to the learner's level",
  "pinyin": "pinyin of reply",
  "translation": "english translation",
  "correction": "optional: if the learner's last message had a mistake, show {answer, correction, tip} as one short object string; else omit",
  "feedback": "one short encouraging line (can include the correction tip)"
}
Keep replies short (1-2 sentences). Stay in the chosen scenario. Language must match learner level. Do not move ahead of the learner.`,

  pronunciation: `Respond ONLY with valid JSON matching this schema:
{
  "score": 0-100,
  "pronounced": "what the learner said (as typed)",
  "expected": "the sentence that was expected (Chinese + pinyin)",
  "issues": [{"detail": "what was wrong", "correction": "how to fix", "tip": "one practical tip (e.g. 3rd tone starts low, dips, rises)"}],
  "next_attempt": "the same sentence, to practice again",
  "praise": "short positive line"
}
Fixations: focus on tone accuracy and initials/finals. If the learner's input seems wrong due to transcription, still compare as best as possible. Max 3 issues.`,

  import_vocab: `Respond ONLY with valid JSON matching this schema:
{
  "vocab": [{"word": "...", "pinyin": "...", "meaning": "...", "example": "...", "example_pinyin": "...", "example_en": "..."}]
}
Extract exactly the new words that were taught in the lesson just completed.`,

  practice_sentence: `Respond ONLY with valid JSON matching this schema:
{
  "sentence": "Chinese sentence chosen for pronunciation practice",
  "pinyin": "with tone marks",
  "translation": "english",
  "focus": "what to focus on (e.g. tone 3, zh vs j, etc)"
}
Choose a sentence using mostly known vocabulary, 3-8 characters long, adapted to the learner's level and their known weak pronunciations.`,

  difficulty: `Respond ONLY with valid JSON matching this schema:
{"level": "one of: absolute_beginner, beginner, elementary, intermediate", "reason": "one short line"}
Infer the learner's level from recent quiz performance and vocabulary mastery.`,
};

const ACTION_PROMPTS = {
  lesson: (payload) => ({
    text: `You are teaching a new short lesson. Topic focus: ${payload.topic || 'practical daily conversation'}.\nCover the material via the lesson blocks. Teach vocabulary inside sentences, not word lists. Provide pinyin for everything. End with a practice block that gives the learner something to actively recall.`,
  }),
  quiz: () => ({
    text: `Create a short quiz (5 questions) for the learner based on their known vocabulary and recent mistakes. Mix active recall formats. Do not include untaught words.`,
  }),
  conversation: (payload) => ({
    text: `You are having a real conversation in Chinese. Scenario: ${payload.scenario || 'introductions'}.\nKeep it natural. The learner's last message: "${payload.last_user_message || ''}"\nIf they made errors, gently correct (per ERROR CORRECTION rules: show answer, correction, simple tip, let them retry). Continue the conversation naturally.`,
  }),
  pronunciation: (payload) => ({
    text: `The learner attempted to speak: "${payload.transcript || ''}"\nExpected sentence: "${payload.sentence || ''}" (${payload.pinyin || ''})\nEvaluate pronunciation and tone accuracy.`,
  }),
  import_vocab: (payload) => ({
    text: payload.words
      ? 'Parse the learner\'s Chinese word list into vocabulary entries: ' + payload.words + '. For each entry provide word, pinyin with tone marks, and meaning. Add a short example sentence or empty strings. Skip empty lines.'
      : 'The learner just finished this lesson: ' + (payload.lesson_text || '') + '. Extract the new vocabulary taught in it.',
  }),
  practice_sentence: (payload) => ({
    text: `Give the learner a short sentence to practice speaking aloud. Consider these recurring mistakes: ${payload.mistakes || 'none yet'}.`,
  }),
  difficulty: () => ({
    text: `Estimate the learner's current level from this data. Be conservative.`,
  }),
};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (e2) {}
    }
    throw new Error('AI returned invalid JSON');
  }
}

async function callAI(system, user, log) {
  if (!AI_KEY || AI_KEY === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('AI API key is not set. Add it in Appwrite Console > Functions > ai-teacher > Variables (AI_API_KEY).');
  }
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.6,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    log(`AI error ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`AI request failed (${res.status})`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function loadLearnerSnapshot(db) {
  const [profile, vocab, mistakes, lessons, quizzes] = await Promise.all([
    db.listRows({ databaseId: DB_ID, tableId: 'learner_profile', queries: [Query.limit(1)] }),
    db.listRows({ databaseId: DB_ID, tableId: 'vocabulary', queries: [Query.limit(300)] }),
    db.listRows({ databaseId: DB_ID, tableId: 'mistakes', queries: [Query.equal('active', true), Query.limit(20)] }),
    db.listRows({ databaseId: DB_ID, tableId: 'lessons', queries: [Query.orderDesc('created_at'), Query.limit(10)] }),
    db.listRows({ databaseId: DB_ID, tableId: 'quiz_attempts', queries: [Query.orderDesc('created_at'), Query.limit(50)] }),
  ]);
  const vocabRows = vocab.rows || [];
  const mistakesRows = mistakes.rows || [];
  const quizRows = quizzes.rows || [];
  const stateCounts = {};
  vocabRows.forEach((v) => {
    stateCounts[v.state || 'NEW'] = (stateCounts[v.state || 'NEW'] || 0) + 1;
  });
  const recentAccuracy = quizRows.length
    ? Math.round((quizRows.filter((q) => q.correct).length / quizRows.length) * 100)
    : null;
  const knownWords = vocabRows.map((v) => `${v.pinyin} (${v.meaning})`).join(', ');
  return {
    profile: (profile.rows && profile.rows[0]) ? profile.rows[0] : { level: 'absolute_beginner' },
    stateCounts,
    knownWords: knownWords.slice(0, 4000),
    mistakes: mistakesRows.map((m) => `${m.kind}: ${m.detail} (x${m.count})`).join(' | '),
    lastLessons: (lessons.rows || []).map((l) => `${l.topic || l.kind}`).join(', '),
    recentAccuracy,
    recentQuiz: quizRows.slice(0, 8).map((q) => (q.correct ? 'ok' : 'miss')).join(' '),
  };
}

function buildSystem(rules, snapshot) {
  const p = snapshot.profile || {};
  return [
    rules.content || '',
    '',
    '--- LEARNER STATE (separate from teaching rules, updated live) ---',
    `Current level: ${p.level || 'absolute_beginner'}`,
    `Vocabulary memory: ${JSON.stringify(snapshot.stateCounts)}`,
    `Known words: ${snapshot.knownWords.slice(0, 3000) || '(none yet)'}`,
    `Recurring mistakes: ${snapshot.mistakes || '(none yet)'}`,
    `Recent lessons: ${snapshot.lastLessons || '(none)'}`,
    `Recent quiz accuracy: ${snapshot.recentAccuracy == null ? '(no quizzes yet)' : snapshot.recentAccuracy + '%'}`,
    `Recent quiz results: ${snapshot.recentQuiz || ''}`,
    '',
    'ADAPT: if the learner performs well, increase difficulty gradually. If they struggle, simplify and give another example. If they repeatedly fail, change approach.',
  ].join('\n');
}

module.exports = async ({ req, res, log, error }) => {
  if (req.method === 'OPTIONS') {
    return res.text('', 204, CORS());
  }

  try {
    const key = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY || '';
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    if (key) client.setKey(key);
    const db = new TablesDB(client);

    const rulesRows = await db.listRows({
      databaseId: DB_ID,
      tableId: 'teaching_rules',
      queries: [Query.equal('rule_key', 'core'), Query.limit(1)],
    });
    const rules = rulesRows.rows && rulesRows.rows[0] ? rulesRows.rows[0] : null;
    if (!rules || !rules.content) {
      throw new Error('Teaching rules not found in database (teaching_rules / rule_key=core). Check the seeded data.');
    }

    const action = (req.bodyJson && req.bodyJson.action) || req.query.action || 'lesson';
    const payload = req.bodyJson || {};

    const snapshot = await loadLearnerSnapshot(db);
    const system = buildSystem(rules, snapshot);

    const schema = SCHEMAS[action] || SCHEMAS.lesson;
    const userPrompt = ACTION_PROMPTS[action] ? ACTION_PROMPTS[action](payload).text : '';
    const fullUser = `${userPrompt}\n\n${schema}`;

    const out = await callAI(system, fullUser, log);
    const parsed = parseJson(out);

    if (action === 'pronunciation') {
      const pb = payload.transcript || '';
      const sb = payload.sentence || '';
      if (parsed.issues && parsed.issues.length && pb && pb !== sb) {
        try {
          const found = await db.listRows({
            databaseId: DB_ID,
            tableId: 'mistakes',
            queries: [Query.equal('detail', parsed.issues[0].detail), Query.limit(1)],
          });
          if (found.rows && found.rows.length) {
            const row = found.rows[0];
            await db.updateRow({
              databaseId: DB_ID,
              tableId: 'mistakes',
              rowId: row.$id,
              data: { count: (row.count || 1) + 1, correction: parsed.issues[0].correction, updated_at: new Date().toISOString() },
            });
          } else {
            await db.createRow({
              databaseId: DB_ID,
              tableId: 'mistakes',
              rowId: 'unique()',
              data: {
                kind: 'pronunciation',
                detail: parsed.issues[0].detail,
                correction: parsed.issues[0].correction,
                target: sb,
                active: true,
                updated_at: new Date().toISOString(),
              },
            });
          }
        } catch (e2) {
          log('mistake log failed: ' + e2.message);
        }
      }
    }

    return res.json({ ok: true, action, ...parsed }, 200, CORS());
  } catch (err) {
    error(err.message);
    return res.json({ ok: false, error: err.message }, 500, CORS());
  }
};