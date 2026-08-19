import { useEffect, useRef, useState } from 'react';
import { db, TABLES, DB_ID, ID } from '../lib/appwrite';
import { ask } from '../lib/ai';
import { speak } from '../lib/speech';

interface Msg {
  speaker: 'teacher' | 'learner';
  content: string;
  pinyin?: string;
  translation?: string;
  correction?: string;
  feedback?: string;
}

interface ConversationData {
  reply: string;
  pinyin: string;
  translation: string;
  correction?: string;
  feedback?: string;
}

const SCENARIOS = ['Introductions', 'At a restaurant', 'Shopping', 'Asking directions', 'Talking about hobbies', 'At work'];

export default function Conversation() {
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const begin = async () => {
    setStarted(true);
    setBusy(true);
    setError('');
    try {
      const res = await ask<ConversationData>('conversation', { scenario, last_user_message: '' });
      const msg: Msg = { speaker: 'teacher', content: res.reply, pinyin: res.pinyin, translation: res.translation, feedback: res.feedback };
      setHistory([msg]);
      await saveTurn(msg);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveTurn = async (msg: Msg) => {
    try {
      await db.createRow({
        databaseId: DB_ID,
        tableId: TABLES.convos,
        rowId: ID.unique(),
        data: {
          scenario,
          speaker: msg.speaker,
          content: msg.content,
          created_at: new Date().toISOString(),
        },
      });
    } catch {}
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const learnerMsg: Msg = { speaker: 'learner', content: text };
    setHistory((h) => [...h, learnerMsg]);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const res = await ask<ConversationData>('conversation', { scenario, last_user_message: text, history: history.slice(-12) });
      const teacherMsg: Msg = {
        speaker: 'teacher',
        content: res.reply,
        pinyin: res.pinyin,
        translation: res.translation,
        correction: res.correction,
        feedback: res.feedback,
      };
      setHistory((h) => [...h, teacherMsg]);
      await Promise.all([saveTurn(learnerMsg), saveTurn(teacherMsg)]);
      if (res.correction) {
        try {
          await db.createRow({
            databaseId: DB_ID,
            tableId: TABLES.mistakes,
            rowId: ID.unique(),
            data: { kind: 'grammar', detail: res.correction, active: true, updated_at: new Date().toISOString() },
          });
        } catch {}
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!started) {
    return (
      <div>
        <h1>Conversation</h1>
        <div className="card">
          <p className="muted">Practice real conversation. Your teacher speaks Chinese at your level, corrects you gently, and helps you keep going.</p>
          <div className="chiprow">
            {SCENARIOS.map((s) => (
              <button key={s} className={scenario === s ? 'chip active' : 'chip'} onClick={() => setScenario(s)}>
                {s}
              </button>
            ))}
          </div>
          <button className="btn block" onClick={begin}>Start conversation</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{scenario} <span className="muted">— {busy ? 'teacher is typing…' : ''}</span></h1>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="chat">
          {history.map((m, i) => (
            <div key={i} className={`msg ${m.speaker}`}>
              {m.speaker === 'teacher' && <button className="speakbtn" style={{ float: 'right', marginLeft: 8 }} onClick={() => speak(m.content)}>🔊</button>}
              {m.content}
              {m.speaker === 'teacher' && m.pinyin && <span className="sub">{m.pinyin}</span>}
              {m.speaker === 'teacher' && m.translation && <span className="sub">{m.translation}</span>}
              {m.speaker === 'teacher' && m.feedback && <span className="sub">{m.feedback}</span>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <textarea
          placeholder="Type your reply in Chinese (pinyin or characters)…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <div className="btnrow">
          <button className="btn" onClick={send} disabled={busy || !input.trim()}>Send</button>
          <button className="btn ghost" onClick={() => speak('')}>🔊</button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>Tip: answer in Chinese. Pinyin is fine at first.</p>
      </div>
    </div>
  );
}
