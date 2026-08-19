import { useState } from 'react';
import { Query } from 'appwrite';
import { db, TABLES, DB_ID, ID } from '../lib/appwrite';
import { ask } from '../lib/ai';
import { speak } from '../lib/speech';

interface ImportVocab {
  word: string;
  pinyin: string;
  meaning: string;
  example?: string;
  example_pinyin?: string;
  example_en?: string;
}

interface ImportResult {
  vocab: ImportVocab[];
}

export default function Import() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<ImportVocab[]>([]);
  const [skipped, setSkipped] = useState<ImportVocab[]>([]);
  const [parsed, setParsed] = useState<ImportVocab[] | null>(null);

  const start = async () => {
    setError('');
    setAdded([]);
    setSkipped([]);
    setLoading(true);
    try {
      const res = await ask<ImportResult>('import_vocab', { words: text });
      setParsed(res.vocab || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!parsed) return;
    setSaving(true);
    const newOnes: ImportVocab[] = [];
    const known: ImportVocab[] = [];
    try {
      for (const v of parsed) {
        const existing = await db.listRows({
          databaseId: DB_ID,
          tableId: TABLES.vocab,
          queries: [Query.equal('word', v.word), Query.limit(1)],
        });
        if (existing.rows && existing.rows.length > 0) {
          known.push(v);
          continue;
        }
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
            source: 'imported',
          },
        });
        newOnes.push(v);
      }
      setAdded(newOnes);
      setSkipped(known);
      setParsed(null);
      setText('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1>Import words</h1>
      <p className="muted">Words from real life — a menu, a sign, something you looked up — go straight into your review deck.</p>

      {!parsed && (
        <div className="card">
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>One per line — any of these formats work:</label>
          <pre className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>咖啡
咖啡 kafei coffee
咖啡, kāfēi, coffee</pre>
          <textarea
            className="input"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'咖啡\n苹果\n谢谢'}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <button className="btn block" onClick={start} disabled={loading || !text.trim()}>
            {loading ? 'Reading your words…' : 'Parse & check'}
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {parsed && (
        <div className="card">
          <h2>Found {parsed.length} words</h2>
          {parsed.map((v, i) => (
            <div key={i} className="row" style={{ marginBottom: 8 }}>
              <b className="zh" style={{ fontSize: 20 }}>{v.word}</b>
              <span>{v.pinyin} — {v.meaning}</span>
              <button className="speakbtn" onClick={() => speak(v.word)}>🔊</button>
            </div>
          ))}
          <div className="btnrow">
            <button className="btn green" onClick={save} disabled={saving}>{saving ? 'Adding…' : 'Add to my deck'}</button>
            <button className="btn ghost" onClick={() => { setParsed(null); }}>Edit</button>
          </div>
        </div>
      )}

      {added.length > 0 && (
        <div className="card">
          <h2>✅ Added {added.length} words</h2>
          <p className="muted">They'll show up in Review as NEW cards.</p>
          <div className="btnrow">
            <button className="btn" onClick={() => { setAdded([]); setSkipped([]); }}>Import more</button>
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="card">
          <h2>Already in your deck ({skipped.length})</h2>
          <p className="muted">{skipped.map((v) => v.word).join(' · ')}</p>
        </div>
      )}
    </div>
  );
}