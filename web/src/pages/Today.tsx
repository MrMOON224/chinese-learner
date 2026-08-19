import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, TABLES, DB_ID, ID } from '../lib/appwrite';
import { Query } from 'appwrite';
import type { Models } from 'appwrite';
import type { VocabRow } from '../lib/srs';
import { XP_PER_STEP, todayKey, toDateKey, nextStreak, levelFromKnown, levelLabel } from '../lib/progress';

type Profile = Models.Row & {
  name: string;
  level: string;
  xp: number;
  streak_days: number;
  last_active: string | null;
};

type Session = Models.Row & {
  date: string;
  reviews_done: number;
  lesson_done: boolean;
  quiz_done: boolean;
  conversation_done: boolean;
  xp_earned: number;
};

interface Step {
  key: string;
  label: string;
  detail: string;
  to: string;
  done: boolean;
  optional?: boolean;
  show: boolean;
}

export default function Today() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vocab, setVocab] = useState<VocabRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [quizzesToday, setQuizzesToday] = useState(0);
  const [pinyinToday, setPinyinToday] = useState(0);
  const [lessonToday, setLessonToday] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, v, s, q, l] = await Promise.all([
          db.listRows<Profile>({ databaseId: DB_ID, tableId: TABLES.profile, queries: [Query.limit(1)] }),
          db.listRows<VocabRow>({ databaseId: DB_ID, tableId: TABLES.vocab, queries: [Query.limit(300)] }),
          db.listRows<Session>({ databaseId: DB_ID, tableId: TABLES.sessions, queries: [Query.equal('date', todayKey()), Query.limit(1)] }),
          db.listRows({ databaseId: DB_ID, tableId: TABLES.quizzes, queries: [Query.orderDesc('created_at'), Query.limit(300)] }),
          db.listRows({ databaseId: DB_ID, tableId: TABLES.lessons, queries: [Query.orderDesc('created_at'), Query.limit(50)] }),
        ]);
        setProfile(p.rows[0] ?? null);
        setVocab(v.rows);
        setSession(s.rows[0] ?? null);
        setLessonToday((l.rows || []).some((r) => toDateKey(r.created_at) === todayKey()));

        const today = todayKey();
        let qu = 0, py = 0;
        for (const r of q.rows || []) {
          if (toDateKey(r.created_at) !== today) continue;
          if (r.item_type === 'pinyin') py++;
          else qu++;
        }
        setQuizzesToday(qu);
        setPinyinToday(py);
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
  const reviewsToday = vocab.filter((r) => r.last_review && toDateKey(r.last_review) === todayKey()).length;

  const level = profile?.level || levelFromKnown(0);
  const showPinyin = level === 'absolute_beginner';

  const steps: Step[] = [
    {
      key: 'pinyin',
      label: 'Pinyin & tones',
      detail: pinyinToday > 0 ? `${pinyinToday} drills done` : 'Learn the sounds of Mandarin first',
      to: '/pinyin',
      done: pinyinToday >= 5,
      show: showPinyin,
    },
    {
      key: 'review',
      label: 'Review words',
      detail: due === 0 ? 'Queue is clear' : `${due} due · ${reviewsToday} done today`,
      to: '/review',
      done: due === 0 || (reviewsToday > 0 && reviewsToday >= Math.min(due, 10)),
      show: true,
    },
    {
      key: 'lesson',
      label: 'Mini lesson',
      detail: lessonToday ? 'Done — new words added to your deck' : 'A short AI lesson with new words',
      to: '/lesson',
      done: lessonToday,
      show: true,
    },
    {
      key: 'quiz',
      label: 'Quick quiz',
      detail: quizzesToday >= 5 ? `${quizzesToday} questions answered` : '5 questions to lock it in',
      to: '/quiz',
      done: quizzesToday >= 5,
      show: true,
    },
    {
      key: 'conversation',
      label: 'Chat practice',
      detail: 'Optional: a few lines with the teacher',
      to: '/conversation',
      done: false,
      show: true,
      optional: true,
    },
  ];

  const visible = steps.filter((s) => s.show);
  const doneCount = visible.filter((s) => s.done).length;
  const xp = doneCount * XP_PER_STEP;
  const maxXp = visible.length * XP_PER_STEP;
  const allDone = doneCount === visible.length;

  const persist = async () => {
    setSaving(true);
    try {
      const today = todayKey();
      let prof = profile;
      let sess = session;
      if (!prof) {
        const created = await db.createRow({
          databaseId: DB_ID,
          tableId: TABLES.profile,
          rowId: ID.unique(),
          data: { name: 'Learner', level: levelFromKnown(0), xp: 0, streak_days: 0, last_active: null, notes: '' },
        });
        prof = created as unknown as Profile;
      }
      if (!sess) {
        const created = await db.createRow<Session>({
          databaseId: DB_ID,
          tableId: TABLES.sessions,
          rowId: ID.unique(),
          data: { date: today, reviews_done: 0, lesson_done: false, quiz_done: false, conversation_done: false, xp_earned: 0 },
        });
        sess = created as unknown as Session;
      }

      const newLevel = levelFromKnown(known);
      const newStreak = nextStreak(prof.last_active, prof.streak_days || 0);
      const todayXp = Math.max(xp, sess.xp_earned || 0);
      const xpDelta = todayXp - (sess.xp_earned || 0);

      const [upProf, upSess] = await Promise.all([
        db.updateRow({
          databaseId: DB_ID,
          tableId: TABLES.profile,
          rowId: prof.$id,
          data: {
            level: newLevel,
            streak_days: newStreak,
            last_active: today,
            xp: (prof.xp || 0) + (xpDelta > 0 ? xpDelta : 0),
          },
        }),
        db.updateRow({
          databaseId: DB_ID,
          tableId: TABLES.sessions,
          rowId: sess.$id,
          data: { xp_earned: todayXp },
        }),
      ]);
      setProfile(upProf as unknown as Profile);
      setSession(upSess as unknown as Session);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1>你好, {profile?.name || 'Learner'} 👋</h1>
      {error && <div className="error">{error}</div>}

      <div className="statrow">
        <div className="stat"><div className="big">{known}</div><div className="muted">words known</div></div>
        <div className="stat"><div className="big">{due}</div><div className="muted">due review</div></div>
        <div className="stat"><div className="big">{profile?.streak_days || 0}</div><div className="muted">day streak</div></div>
        <div className="stat"><div className="big">{xp}/{maxXp}</div><div className="muted">XP today</div></div>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Level: <b>{levelLabel(level)}</b> · Total XP: {profile?.xp || 0}
      </p>

      <div className="card">
        <h2>Today's session</h2>
        {allDone ? (
          <p style={{ margin: '6px 0 12px' }}>🎉 Session complete — come back tomorrow to keep the streak!</p>
        ) : (
          <p className="muted" style={{ margin: '0 0 12px' }}>Work through these in order (~30 min).</p>
        )}
        <ol className="steps">
          {visible.map((s) => (
            <li key={s.key} className={s.done ? 'step done' : 'step'}>
              <span className="stepmark">{s.done ? '✓' : '○'}</span>
              <Link to={s.to} className="steplink">
                <b>{s.label}</b>
                <span className="muted">{s.detail}</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="barwrap" style={{ marginTop: 12 }}>
          <span className="muted" style={{ width: 90 }}>XP progress</span>
          <div className="bar"><div style={{ width: `${(xp / maxXp) * 100}%`, background: '#2e7d4f' }} /></div>
          <span className="muted" style={{ width: 40 }}>{doneCount}/{visible.length}</span>
        </div>
        <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={persist} disabled={saving}>
          {saving ? 'Saving…' : 'Sync streak & XP'}
        </button>
      </div>

      {vocab.length > 0 && (
        <div className="card">
          <h2>Vocabulary memory</h2>
          {(['NEW', 'LEARNING', 'FAMILIAR', 'MASTERED', 'WEAK'] as const).map((st) => (
            <div className="barwrap" key={st}>
              <span className="muted" style={{ width: 70 }}>{st}</span>
              <div className="bar">
                <div style={{ width: `${((states[st] || 0) / vocab.length) * 100}%`, background: st === 'NEW' ? '#9aa7b5' : st === 'LEARNING' ? '#e8a13a' : st === 'FAMILIAR' ? '#5b8cc9' : st === 'MASTERED' ? '#2e7d4f' : '#c23b22' }} />
              </div>
              <span className="muted" style={{ width: 30 }}>{states[st] || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}