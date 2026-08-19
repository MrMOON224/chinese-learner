import { useState } from 'react';
import { db, TABLES, DB_ID, ID } from '../lib/appwrite';
import { ask } from '../lib/ai';
import { speak } from '../lib/speech';

interface Question {
  item_type: 'vocab' | 'pattern' | 'listening';
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface QuizData {
  questions: Question[];
}

export default function Quiz() {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const start = async () => {
    setError('');
    setQuiz(null);
    setDone(false);
    setScore(0);
    setLoading(true);
    try {
      setQuiz(await ask<QuizData>('quiz'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const [qIndex, setQIndex] = useState(0);

  const pick = async (i: number) => {
    if (picked !== null || !quiz) return;
    setPicked(i);
    const correct = i === quiz.questions[qIndex].answer;
    if (correct) setScore((s) => s + 1);
    try {
      await db.createRow({
        databaseId: DB_ID,
        tableId: TABLES.quizzes,
        rowId: ID.unique(),
        data: {
          item_type: quiz.questions[qIndex].item_type,
          question: quiz.questions[qIndex].question,
          answer: quiz.questions[qIndex].options[quiz.questions[qIndex].answer],
          correct,
          difficulty: 1,
          created_at: new Date().toISOString(),
        },
      });
    } catch {}
  };

  const next = () => {
    if (!quiz) return;
    if (qIndex + 1 >= quiz.questions.length) {
      setDone(true);
    } else {
      setQIndex((i) => i + 1);
      setPicked(null);
    }
  };

  return (
    <div>
      <h1>Quiz</h1>
      {!quiz && !loading && (
        <div className="card">
          <p className="muted">A short 5-question quiz built from words you already know, with a couple of pattern substitutions. Difficulty adapts to your recent performance.</p>
          <button className="btn block" onClick={start}>Start quiz</button>
        </div>
      )}
      {loading && <div className="card"><p className="muted">Preparing questions…</p></div>}
      {error && <div className="error">{error}</div>}

      {quiz && !done && (
        <div className="card">
          <p className="muted">Question {qIndex + 1} / {quiz.questions.length}</p>
          <h2 className="zh" style={{ fontSize: 19 }}>{quiz.questions[qIndex].question}</h2>
          {quiz.questions[qIndex].item_type === 'listening' && (
            <button className="speakbtn" onClick={() => speak(quiz.questions[qIndex].question)}>🔊 Listen</button>
          )}
          {quiz.questions[qIndex].options.map((opt, i) => {
            let cls = 'option';
            if (picked !== null) {
              if (i === quiz.questions[qIndex].answer) cls += ' correct';
              else if (i === picked) cls += ' wrong';
            }
            return (
              <button key={i} className={cls} onClick={() => pick(i)} disabled={picked !== null}>
                {opt}
              </button>
            );
          })}
          {picked !== null && (
            <div>
              <p className="muted">{quiz.questions[qIndex].explanation}</p>
              <button className="btn block" onClick={next}>{qIndex + 1 >= quiz.questions.length ? 'See results' : 'Next question'}</button>
            </div>
          )}
        </div>
      )}

      {quiz && done && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="score-big">{score} / {quiz.questions.length}</div>
          <p className="muted">
            {score === quiz.questions.length ? 'Perfect! 太棒了！' : score >= 3 ? 'Good job — keep going.' : 'No worries — review the weak words and try again.'}
          </p>
          <button className="btn block" onClick={start}>Take another quiz</button>
        </div>
      )}
    </div>
  );
}
