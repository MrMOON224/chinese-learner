import { useEffect, useState } from 'react';
import { Query } from 'appwrite';
import { db, TABLES, DB_ID } from '../lib/appwrite';
import { ask } from '../lib/ai';
import { speak, startListening, recognitionSupported, speechSupported } from '../lib/speech';

interface PracticeData {
  sentence: string;
  pinyin: string;
  translation: string;
  focus: string;
}

interface FeedbackData {
  score: number;
  pronounced: string;
  expected: string;
  issues: { detail: string; correction: string; tip: string }[];
  next_attempt: string;
  praise: string;
}

export default function Speaking() {
  const [practice, setPractice] = useState<PracticeData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMistakes();
  }, []);

  const loadMistakes = async () => {
    try {
      const res = await db.listRows({
        databaseId: DB_ID,
        tableId: TABLES.mistakes,
        queries: [Query.equal('active', true), Query.limit(10)],
      });
      const text = (res.rows || []).map((r) => (r as any).detail).join('; ');
      if (text) localStorage.setItem('mistakes_ctx', text);
    } catch {}
  };

  const newPractice = async () => {
    setLoading(true);
    setError('');
    setFeedback(null);
    setTranscript('');
    try {
      const res = await ask<PracticeData>('practice_sentence', { mistakes: localStorage.getItem('mistakes_ctx') || '' });
      setPractice(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const record = () => {
    if (!practice || listening) return;
    setListening(true);
    setError('');
    startListening(
      (text) => setTranscript(text),
      () => setListening(false),
      (msg) => setError(msg)
    );
  };

  const grade = async () => {
    if (!practice || !transcript) return;
    setLoading(true);
    setError('');
    try {
      const res = await ask<FeedbackData>('pronunciation', {
        sentence: practice.sentence,
        pinyin: practice.pinyin,
        transcript,
      });
      setFeedback(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const again = () => {
    setFeedback(null);
    setTranscript('');
    if (practice) speak(practice.sentence);
  };

  if (!practice && !loading) {
    return (
      <div>
        <h1>Speaking practice</h1>
        <div className="card">
          <p className="muted">
            Your teacher gives you a short sentence to say out loud. You speak, the app transcribes (Chrome + mic required), and the teacher scores your pronunciation and tones.
          </p>
          {!recognitionSupported() && (
            <div className="error">Speech recognition needs Chrome (or Edge) with microphone permission.</div>
          )}
          <button className="btn block" onClick={newPractice}>Get a sentence</button>
        </div>
      </div>
    );
  }

  if (loading && !practice) return <div className="card"><p className="muted">Picking a sentence for you…</p></div>;

  return (
    <div>
      <h1>Speaking practice</h1>
      {error && <div className="error">{error}</div>}

      {practice && !feedback && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted">Focus: {practice.focus}</p>
          <p className="zh" style={{ fontSize: 34, margin: '12px 0' }}>{practice.sentence}</p>
          <p style={{ fontSize: 17 }}>{practice.pinyin}</p>
          <p className="muted">{practice.translation}</p>
          <div className="btnrow">
            <button className="btn" onClick={() => speak(practice.sentence, 0.7)}>🔊 Listen</button>
            <button className="btn green" onClick={record} disabled={listening}>
              {listening ? '🎙️ Listening…' : '🎙️ Say it'}
            </button>
          </div>
          {transcript && (
            <div style={{ marginTop: 14 }}>
              <p className="muted">I heard: <b>{transcript}</b></p>
              <button className="btn block" onClick={grade} disabled={loading}>Get teacher feedback</button>
            </div>
          )}
          <p className="muted" style={{ marginTop: 12 }}>{speechSupported() ? '' : 'Text-to-speech not supported in this browser.'}</p>
        </div>
      )}

      {feedback && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted">{feedback.praise}</p>
          <div className="score-big">{feedback.score}</div>
          <p className="muted">You said: {feedback.pronounced}</p>
          <p className="zh" style={{ fontSize: 20 }}>{feedback.expected}</p>
          {feedback.issues.length > 0 ? (
            <ul className="plain" style={{ textAlign: 'left' }}>
              {feedback.issues.map((iss, i) => (
                <li key={i}>
                  <b>{iss.detail}</b>
                  <br /><span className="muted">Fix: {iss.correction} — {iss.tip}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No major issues detected — nice work!</p>
          )}
          <div className="btnrow">
            <button className="btn" onClick={again}>Practice again</button>
            <button className="btn green" onClick={newPractice}>New sentence</button>
          </div>
        </div>
      )}
    </div>
  );
}
