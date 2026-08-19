import { useState } from 'react';
import { Query } from 'appwrite';
import { db, TABLES, DB_ID, ID } from '../lib/appwrite';
import { ask } from '../lib/ai';
import { speak } from '../lib/speech';

interface VocabItem {
  word: string;
  pinyin: string;
  meaning: string;
  example: string;
  example_pinyin?: string;
  example_en?: string;
}

interface LessonBlock {
  kind: 'text' | 'vocab' | 'pattern' | 'practice';
  text?: string;
  word?: string;
  pinyin?: string;
  meaning?: string;
  example?: string;
  example_pinyin?: string;
  example_en?: string;
  chinese?: string;
  note?: string;
  prompt?: string;
  hint?: string;
}

interface LessonData {
  title: string;
  outcome: string;
  blocks: LessonBlock[];
  vocab: VocabItem[];
}

const TOPICS = ['Greetings', 'Food & drink', 'Shopping', 'Travel', 'Daily life', 'Family & friends'];

export default function Lesson() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const start = async () => {
    setError('');
    setDone(false);
    setLesson(null);
    setLoading(true);
    try {
      const res = await ask<LessonData>('lesson', { topic });
      setLesson(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const finish = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await db.createRow({
        databaseId: DB_ID,
        tableId: TABLES.lessons,
        rowId: ID.unique(),
        data: {
          kind: 'lesson',
          topic: lesson.title,
          summary: lesson.outcome,
          created_at: now,
        },
      });
      for (const v of lesson.vocab) {
        const existing = await db.listRows({
          databaseId: DB_ID,
          tableId: TABLES.vocab,
          queries: [Query.equal('word', v.word), Query.limit(1)],
        });
        if (!existing.rows || existing.rows.length === 0) {
          await db.createRow({
            databaseId: DB_ID,
            tableId: TABLES.vocab,
            rowId: ID.unique(),
            data: {
              word: v.word,
              pinyin: v.pinyin,
              meaning: v.meaning,
              example: v.example || '',
              example_pinyin: v.example_pinyin || '',
              example_en: v.example_en || '',
              state: 'NEW',
              source: lesson.title,
            },
          });
        }
      }
      const p = await db.listRows({ databaseId: DB_ID, tableId: TABLES.profile, queries: [Query.limit(1)] });
      if (p.rows && p.rows[0]) {
        const cur = p.rows[0];
        await db.updateRow({
          databaseId: DB_ID,
          tableId: TABLES.profile,
          rowId: cur.$id,
          data: { xp: (cur.xp || 0) + 10, last_active: now },
        });
      }
      setDone(true);
    } catch (e: any) {
      setError('Saved, but: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1>Lesson</h1>
      {!lesson && !loading && (
        <>
          <p className="muted">Pick a situation. Each lesson takes about 5 minutes and ends with something you can actually say.</p>
          <div className="chiprow">
            {TOPICS.map((t) => (
              <button key={t} className={topic === t ? 'chip active' : 'chip'} onClick={() => setTopic(t)}>
                {t}
              </button>
            ))}
          </div>
          <button className="btn block" onClick={start}>Start lesson</button>
        </>
      )}

      {loading && <div className="card"><p className="muted">Your teacher is preparing the lesson…</p></div>}
      {error && <div className="error">{error}</div>}

      {lesson && !done && (
        <div>
          <div className="card">
            <h2>{lesson.title}</h2>
            <p className="muted">Goal: {lesson.outcome}</p>
          </div>
          {lesson.blocks.map((b, i) => {
            if (b.kind === 'text') return <div key={i} className="block"><p>{b.text}</p></div>;
            if (b.kind === 'vocab') return (
              <div key={i} className="block vocab">
                <div className="row">
                  <b className="zh" style={{ fontSize: 22 }}>{b.word}</b>
                  <button className="speakbtn" onClick={() => speak(b.word || '')}>🔊</button>
                </div>
                <p>{b.pinyin} — {b.meaning}</p>
                <p className="zh">{b.example}</p>
                {b.example_pinyin && <p className="muted">{b.example_pinyin}</p>}
                {b.example_en && <p className="muted">{b.example_en}</p>}
              </div>
            );
            if (b.kind === 'pattern') return (
              <div key={i} className="block pattern">
                <p className="muted" style={{ marginTop: 0 }}>Pattern</p>
                <div className="row">
                  <b className="zh" style={{ fontSize: 18 }}>{b.chinese}</b>
                  <button className="speakbtn" onClick={() => speak(b.chinese || '')}>🔊</button>
                </div>
                <p>{b.pinyin} — {b.meaning}</p>
                {b.note && <p className="muted">{b.note}</p>}
              </div>
            );
            return (
              <div key={i} className="card">
                <p><b>Practice:</b> {b.prompt}</p>
                <p className="zh" style={{ fontSize: 20 }}>{b.chinese}</p>
                <p>{b.pinyin}</p>
                <p className="muted">💡 {b.hint}</p>
                <button className="btn ghost sm" onClick={() => speak(b.chinese || '')}>🔊 Listen & repeat out loud</button>
              </div>
            );
          })}
          <button className="btn block" onClick={finish} disabled={saving}>
            {saving ? 'Saving…' : 'I finished — save my progress'}
          </button>
        </div>
      )}

      {done && (
        <div className="card">
          <h2>🎉 Lesson complete</h2>
          <p>You can now say: <b className="zh">{lesson?.outcome}</b></p>
          <p className="muted">New words were added to your spaced-repetition queue.</p>
          <div className="btnrow">
            <button className="btn" onClick={start}>Another lesson</button>
            <button className="btn green" onClick={() => { setLesson(null); setDone(false); }}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
