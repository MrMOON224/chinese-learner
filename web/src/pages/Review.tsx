import { useEffect, useState } from 'react';
import { Query } from 'appwrite';
import { db, TABLES, DB_ID } from '../lib/appwrite';
import { applySrs, type VocabRow, type Grade } from '../lib/srs';
import { speak } from '../lib/speech';

export default function Review() {
  const [queue, setQueue] = useState<VocabRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ again: 0, good: 0 });

  useEffect(() => {
    (async () => {
      try {
        const res = await db.listRows<VocabRow>({
          databaseId: DB_ID,
          tableId: TABLES.vocab,
          queries: [Query.limit(300)],
        });
        const now = Date.now();
        const due = res.rows.filter(
          (r) =>
            r.state !== 'MASTERED' &&
            (r.state === 'NEW' || (r.due_at && new Date(r.due_at).getTime() <= now) || r.state === 'WEAK')
        );
        due.sort((a, b) => {
          const sa = (a.state === 'WEAK' ? 0 : a.state === 'NEW' ? 1 : 2);
          const sb = (b.state === 'WEAK' ? 0 : b.state === 'NEW' ? 1 : 2);
          return sa - sb;
        });
        setQueue(due);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grade = async (g: Grade) => {
    const row = queue[idx];
    const srs = applySrs(row, g);
    const now = new Date();
    const dueAt = new Date(now.getTime() + srs.intervalDays * 86400000).toISOString();
    try {
      await db.updateRow({
        databaseId: DB_ID,
        tableId: TABLES.vocab,
        rowId: row.$id,
        data: {
          state: srs.state,
          repetitions: srs.repetitions,
          interval_days: srs.intervalDays,
          ease: Math.round(srs.ease * 100) / 100,
          lapses: srs.lapses,
          due_at: dueAt,
          last_review: now.toISOString(),
        },
      });
    } catch (e: any) {
      setError(e.message);
    }
    setStats((s) => ({ ...s, [g]: (s as any)[g] + 1 }));
    setFlipped(false);
    setIdx((i) => i + 1);
  };

  if (loading) return <div className="card"><p className="muted">Loading your review queue…</p></div>;
  if (error) return <div className="error">{error}</div>;

  if (queue.length === 0) {
    return (
      <div>
        <h1>Review</h1>
        <div className="card">
          <h2>All caught up 🎉</h2>
          <p className="muted">No words are due right now. New words appear here after lessons.</p>
        </div>
      </div>
    );
  }

  if (idx >= queue.length) {
    return (
      <div>
        <h1>Review complete</h1>
        <div className="card">
          <h2>Done for now ✅</h2>
          <p className="muted">Reviewed {queue.length} words — {stats.good} remembered, {stats.again} need more practice.</p>
          <p className="muted">Words you forgot are now marked WEAK and will come back soon.</p>
        </div>
      </div>
    );
  }

  const v = queue[idx];

  return (
    <div>
      <h1>Review <span className="muted">({idx + 1}/{queue.length})</span></h1>
      <div className="card" style={{ textAlign: 'center', padding: '26px 16px' }}>
        {!flipped ? (
          <>
            <p className="muted">What does this mean?</p>
            <p className="zh" style={{ fontSize: 44, margin: '10px 0' }}>{v.word}</p>
            <p style={{ fontSize: 18 }}>{v.pinyin}</p>
            <button className="btn ghost block" onClick={() => setFlipped(true)}>Show answer</button>
          </>
        ) : (
          <>
            <p className="muted">Answer</p>
            <p style={{ fontSize: 22, fontWeight: 700 }}>{v.meaning}</p>
            <p className="zh" style={{ fontSize: 17 }}>{v.example}</p>
            {v.example_pinyin && <p className="muted">{v.example_pinyin}</p>}
            {v.example_en && <p className="muted">{v.example_en}</p>}
            <button className="speakbtn" onClick={() => speak(v.word)} style={{ marginTop: 8 }}>🔊 Listen</button>
            <p className="muted" style={{ marginTop: 14 }}>How well did you remember it?</p>
            <div className="btnrow">
              <button className="btn" onClick={() => grade('again')}>Again</button>
              <button className="btn ghost" onClick={() => grade('hard')}>Hard</button>
              <button className="btn green" onClick={() => grade('good')}>Good</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
