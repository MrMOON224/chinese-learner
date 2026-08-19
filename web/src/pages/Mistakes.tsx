import { useEffect, useState } from 'react';
import { Query } from 'appwrite';
import { db, TABLES, DB_ID } from '../lib/appwrite';
import Quiz from './Quiz';

export default function Mistakes() {
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await db.listRows({
          databaseId: DB_ID,
          tableId: TABLES.mistakes,
          queries: [Query.equal('active', true), Query.orderDesc('count'), Query.limit(20)],
        });
        setMistakes(res.rows || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h1>Fix your mistakes</h1>
      <p className="muted">Collected from your pronunciation practice and chats. The quiz below targets exactly these.</p>

      {loading && <div className="card"><p className="muted">Checking…</p></div>}

      {!loading && mistakes.length === 0 && (
        <div className="card">
          <h2>No recorded mistakes 🎉</h2>
          <p className="muted">Make a mistake in Chat or Speak practice and it will show up here for drilling.</p>
        </div>
      )}

      {mistakes.length > 0 && (
        <>
          <div className="card">
            <h2>Your recurring issues</h2>
            <ul className="plain">
              {mistakes.map((m) => (
                <li key={m.$id}>
                  <b>{m.kind}</b> — {m.detail}
                  {m.correction && <span className="muted"> → {m.correction}</span>}
                  {m.count > 1 && <span className="muted"> (x{m.count})</span>}
                </li>
              ))}
            </ul>
          </div>
          <Quiz focus="mistakes" />
        </>
      )}
    </div>
  );
}