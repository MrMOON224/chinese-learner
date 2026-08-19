import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, TABLES, DB_ID } from '../lib/appwrite';
import { Query } from 'appwrite';
import type { VocabRow } from '../lib/srs';

import type { Models } from 'appwrite';

type Profile = Models.Row & {
  name: string;
  level: string;
  xp: number;
  streak_days: number;
  last_active: string | null;
};

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vocab, setVocab] = useState<VocabRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, v] = await Promise.all([
          db.listRows<Profile>({ databaseId: DB_ID, tableId: TABLES.profile, queries: [Query.limit(1)] }),
          db.listRows<VocabRow>({ databaseId: DB_ID, tableId: TABLES.vocab, queries: [Query.limit(300)] }),
        ]);
        setProfile(p.rows[0] ?? null);
        setVocab(v.rows);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  const states: Record<string, number> = {};
  vocab.forEach((r) => {
    states[r.state] = (states[r.state] || 0) + 1;
  });
  const known = (states.MASTERED || 0) + (states.FAMILIAR || 0) + (states.LEARNING || 0);
  const due = vocab.filter((r) => r.state === 'NEW' || (r.due_at && new Date(r.due_at).getTime() <= Date.now())).length;

  const levelLabel = profile?.level?.replace(/_/g, ' ') || 'absolute beginner';

  return (
    <div>
      <h1>你好, {profile?.name || 'Learner'} 👋</h1>
      {error && <div className="error">{error}</div>}

      <div className="statrow">
        <div className="stat"><div className="big">{known}</div><div className="muted">words known</div></div>
        <div className="stat"><div className="big">{due}</div><div className="muted">due for review</div></div>
        <div className="stat"><div className="big">{profile?.xp || 0}</div><div className="muted">XP</div></div>
      </div>

      <p className="muted" style={{ marginTop: 10 }}>
        Level: <b>{levelLabel}</b> · Streak: <b>{profile?.streak_days || 0} days</b>
      </p>

      <div className="card">
        <h2>Continue learning</h2>
        <div className="btnrow">
          <Link className="btn" to="/lesson">New lesson</Link>
          <Link className="btn green" to="/review">Review ({due})</Link>
        </div>
        <div className="btnrow">
          <Link className="btn ghost" to="/quiz">Quick quiz</Link>
          <Link className="btn ghost" to="/speaking">Speak & pronounce</Link>
        </div>
        <div className="btnrow">
          <Link className="btn ghost" to="/conversation">Chat in Chinese</Link>
        </div>
      </div>

      {vocab.length > 0 && (
        <div className="card">
          <h2>Vocabulary memory</h2>
          <div className="barwrap">
            <span className="muted" style={{ width: 70 }}>NEW</span>
            <div className="bar"><div style={{ width: `${(states.NEW || 0) / vocab.length * 100}%`, background: '#9aa7b5' }} /></div>
            <span className="muted" style={{ width: 30 }}>{states.NEW || 0}</span>
          </div>
          <div className="barwrap">
            <span className="muted" style={{ width: 70 }}>LEARNING</span>
            <div className="bar"><div style={{ width: `${(states.LEARNING || 0) / vocab.length * 100}%`, background: '#e8a13a' }} /></div>
            <span className="muted" style={{ width: 30 }}>{states.LEARNING || 0}</span>
          </div>
          <div className="barwrap">
            <span className="muted" style={{ width: 70 }}>FAMILIAR</span>
            <div className="bar"><div style={{ width: `${(states.FAMILIAR || 0) / vocab.length * 100}%`, background: '#5b8cc9' }} /></div>
            <span className="muted" style={{ width: 30 }}>{states.FAMILIAR || 0}</span>
          </div>
          <div className="barwrap">
            <span className="muted" style={{ width: 70 }}>MASTERED</span>
            <div className="bar"><div style={{ width: `${(states.MASTERED || 0) / vocab.length * 100}%`, background: '#2e7d4f' }} /></div>
            <span className="muted" style={{ width: 30 }}>{states.MASTERED || 0}</span>
          </div>
          <div className="barwrap">
            <span className="muted" style={{ width: 70 }}>WEAK</span>
            <div className="bar"><div style={{ width: `${(states.WEAK || 0) / vocab.length * 100}%`, background: '#c23b22' }} /></div>
            <span className="muted" style={{ width: 30 }}>{states.WEAK || 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}
