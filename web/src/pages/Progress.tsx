import { useEffect, useState } from 'react';
import { Query } from 'appwrite';
import { db, TABLES, DB_ID } from '../lib/appwrite';
import type { VocabRow } from '../lib/srs';

export default function Progress() {
  const [vocab, setVocab] = useState<VocabRow[]>([]);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [v, m, q, l, p] = await Promise.all([
          db.listRows<VocabRow>({ databaseId: DB_ID, tableId: TABLES.vocab, queries: [Query.limit(300)] }),
          db.listRows({ databaseId: DB_ID, tableId: TABLES.mistakes, queries: [Query.equal('active', true), Query.orderDesc('updated_at'), Query.limit(20)] }),
          db.listRows({ databaseId: DB_ID, tableId: TABLES.quizzes, queries: [Query.orderDesc('created_at'), Query.limit(100)] }),
          db.listRows({ databaseId: DB_ID, tableId: TABLES.lessons, queries: [Query.orderDesc('created_at'), Query.limit(20)] }),
          db.listRows({ databaseId: DB_ID, tableId: TABLES.profile, queries: [Query.limit(1)] }),
        ]);
        setVocab(v.rows);
        setMistakes(m.rows || []);
        setQuizzes(q.rows || []);
        setLessons(l.rows || []);
        setProfile(p.rows?.[0] || null);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  const states: Record<string, number> = {};
  vocab.forEach((r) => {
    states[r.state] = (states[r.state] || 0) + 1;
  });
  const total = vocab.length || 1;
  const correct = quizzes.filter((x) => x.correct).length;
  const accuracy = quizzes.length ? Math.round((correct / quizzes.length) * 100) : null;

  return (
    <div>
      <h1>Progress</h1>
      {error && <div className="error">{error}</div>}

      <div className="statrow">
        <div className="stat"><div className="big">{vocab.length}</div><div className="muted">words total</div></div>
        <div className="stat"><div className="big">{accuracy ?? '—'}{accuracy !== null ? '%' : ''}</div><div className="muted">quiz accuracy</div></div>
        <div className="stat"><div className="big">{profile?.xp || 0}</div><div className="muted">XP</div></div>
      </div>

      <div className="card">
        <h2>Vocabulary by state</h2>
        <div className="barwrap"><span className="muted" style={{ width: 80 }}>NEW</span><div className="bar"><div style={{ width: `${(states.NEW || 0) / total * 100}%`, background: '#9aa7b5' }} /></div><span className="muted" style={{ width: 30 }}>{states.NEW || 0}</span></div>
        <div className="barwrap"><span className="muted" style={{ width: 80 }}>LEARNING</span><div className="bar"><div style={{ width: `${(states.LEARNING || 0) / total * 100}%`, background: '#e8a13a' }} /></div><span className="muted" style={{ width: 30 }}>{states.LEARNING || 0}</span></div>
        <div className="barwrap"><span className="muted" style={{ width: 80 }}>FAMILIAR</span><div className="bar"><div style={{ width: `${(states.FAMILIAR || 0) / total * 100}%`, background: '#5b8cc9' }} /></div><span className="muted" style={{ width: 30 }}>{states.FAMILIAR || 0}</span></div>
        <div className="barwrap"><span className="muted" style={{ width: 80 }}>MASTERED</span><div className="bar"><div style={{ width: `${(states.MASTERED || 0) / total * 100}%`, background: '#2e7d4f' }} /></div><span className="muted" style={{ width: 30 }}>{states.MASTERED || 0}</span></div>
        <div className="barwrap"><span className="muted" style={{ width: 80 }}>WEAK</span><div className="bar"><div style={{ width: `${(states.WEAK || 0) / total * 100}%`, background: '#c23b22' }} /></div><span className="muted" style={{ width: 30 }}>{states.WEAK || 0}</span></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Recurring mistakes</h2>
          {mistakes.length === 0 && <p className="muted">None recorded yet.</p>}
          <ul className="plain">
            {mistakes.slice(0, 8).map((m) => (
              <li key={m.$id}>
                <b>{m.kind}</b> — {m.detail}
                {m.count > 1 && <span className="muted"> (x{m.count})</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Recent lessons</h2>
          {lessons.length === 0 && <p className="muted">No lessons yet.</p>}
          <ul className="plain">
            {lessons.slice(0, 8).map((l) => (
              <li key={l.$id}>
                <b>{l.kind}</b> — {l.topic}
                <br /><span className="muted">{new Date(l.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
