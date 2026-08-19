import { useState } from 'react';
import { db, TABLES, DB_ID, ID } from '../lib/appwrite';
import { speak } from '../lib/speech';

const TONES = [
  { n: 1, mark: 'ā', name: '1st — high & flat', desc: 'start high, stay level', color: '#c23b22' },
  { n: 2, mark: 'á', name: '2nd — rising', desc: 'rise from mid to high, like asking "what?"', color: '#e8a13a' },
  { n: 3, mark: 'ǎ', name: '3rd — dipping', desc: 'fall low then rise, a "dip"', color: '#2e7d4f' },
  { n: 4, mark: 'à', name: '4th — falling', desc: 'sharp drop, like a firm "no!"', color: '#5b8cc9' },
  { n: 0, mark: 'a', name: 'neutral — light & short', desc: 'no tone, said very lightly', color: '#9aa7b5' },
];

const MA_ROW = [
  { pinyin: 'mā', hanzi: '妈', meaning: 'mother' },
  { pinyin: 'má', hanzi: '麻', meaning: 'hemp' },
  { pinyin: 'mǎ', hanzi: '马', meaning: 'horse' },
  { pinyin: 'mà', hanzi: '骂', meaning: 'scold' },
  { pinyin: 'ma', hanzi: '吗', meaning: 'question particle' },
];

const INITIALS = [
  { i: 'b', ex: 'bàba', en: 'father' }, { i: 'p', ex: 'pí', en: 'skin' }, { i: 'm', ex: 'mā', en: 'mother' }, { i: 'f', ex: 'fā', en: 'send' },
  { i: 'd', ex: 'dà', en: 'big' }, { i: 't', ex: 'tā', en: 'he' }, { i: 'n', ex: 'nǐ', en: 'you' }, { i: 'l', ex: 'lái', en: 'come' },
  { i: 'g', ex: 'gāo', en: 'tall' }, { i: 'k', ex: 'kāi', en: 'open' }, { i: 'h', ex: 'hǎo', en: 'good' },
  { i: 'j', ex: 'jiā', en: 'home' }, { i: 'q', ex: 'qī', en: 'seven' }, { i: 'x', ex: 'xǐ', en: 'wash' },
  { i: 'zh', ex: 'zhōng', en: 'middle' }, { i: 'ch', ex: 'chī', en: 'eat' }, { i: 'sh', ex: 'shuǐ', en: 'water' }, { i: 'r', ex: 'rén', en: 'person' },
  { i: 'z', ex: 'zài', en: 'at' }, { i: 'c', ex: 'cài', en: 'dish' }, { i: 's', ex: 'sān', en: 'three' },
  { i: 'y', ex: 'yào', en: 'want' }, { i: 'w', ex: 'wǒ', en: 'I' },
];

const FINALS: Array<{ f: string; ex: string }> = [
  { f: 'a', ex: 'bā' }, { f: 'o', ex: 'bō' }, { f: 'e', ex: 'gē' }, { f: 'i', ex: 'dī' }, { f: 'u', ex: 'kū' }, { f: 'ü', ex: 'lǜ' },
  { f: 'ai', ex: 'kāi' }, { f: 'ei', ex: 'bēi' }, { f: 'ao', ex: 'hǎo' }, { f: 'ou', ex: 'kǒu' },
  { f: 'an', ex: 'bān' }, { f: 'en', ex: 'hěn' }, { f: 'ang', ex: 'bāng' }, { f: 'eng', ex: 'bēng' }, { f: 'er', ex: 'èr' },
  { f: 'ia', ex: 'jiā' }, { f: 'ie', ex: 'xiè' }, { f: 'iao', ex: 'biǎo' }, { f: 'iu', ex: 'liù' }, { f: 'ian', ex: 'qiān' }, { f: 'in', ex: 'jīn' }, { f: 'ing', ex: 'qīng' },
  { f: 'ua', ex: 'huā' }, { f: 'uo', ex: 'guǒ' }, { f: 'uai', ex: 'kuài' }, { f: 'ui', ex: 'shuǐ' }, { f: 'uan', ex: 'guān' }, { f: 'un', ex: 'cūn' }, { f: 'uang', ex: 'chuáng' },
  { f: 'ong', ex: 'hóng' }, { f: 'üe', ex: 'xuě' }, { f: 'üan', ex: 'yuàn' }, { f: 'ün', ex: 'yún' },
];

const RULES = [
  { t: 'j, q, x + ü', d: 'The dots are dropped: jü → ju, qü → qu, xü → xu. (j, q, x never take plain u.)' },
  { t: 'Standalone ü', d: 'A ü on its own becomes yu: ü → yu, üe → yue, üan → yuan, ün → yun.' },
  { t: 'y / w spelling', d: 'i alone → yi, u alone → wu, and u after a consonant is still pronounced like ü: lu vs lü — different words!' },
  { t: 'Neutral tone', d: 'No tone mark. Said light and short. Common in 吗 ma, 了 le, and second syllable of 谢谢 xièxie.' },
];

const TONE_POOL = [
  { pinyin: 'mā', hanzi: '妈' }, { pinyin: 'má', hanzi: '麻' }, { pinyin: 'mǎ', hanzi: '马' }, { pinyin: 'mà', hanzi: '骂' },
  { pinyin: 'bā', hanzi: '八' }, { pinyin: 'bá', hanzi: '拔' }, { pinyin: 'bǎ', hanzi: '把' }, { pinyin: 'bà', hanzi: '爸' },
  { pinyin: 'dā', hanzi: '搭' }, { pinyin: 'dá', hanzi: '答' }, { pinyin: 'dǎ', hanzi: '打' }, { pinyin: 'dà', hanzi: '大' },
  { pinyin: 'tī', hanzi: '踢' }, { pinyin: 'tí', hanzi: '提' }, { pinyin: 'tǐ', hanzi: '体' }, { pinyin: 'tì', hanzi: '替' },
  { pinyin: 'mī', hanzi: '咪' }, { pinyin: 'mí', hanzi: '迷' }, { pinyin: 'mǐ', hanzi: '米' }, { pinyin: 'mì', hanzi: '密' },
  { pinyin: 'hē', hanzi: '喝' }, { pinyin: 'hé', hanzi: '和' }, { pinyin: 'hè', hanzi: '贺' },
  { pinyin: 'yī', hanzi: '一' }, { pinyin: 'yí', hanzi: '移' }, { pinyin: 'yǐ', hanzi: '椅' }, { pinyin: 'yì', hanzi: '亿' },
];

const SPELL_POOL = [
  { hanzi: '你好', pinyin: 'nǐ hǎo', en: 'hello' },
  { hanzi: '谢谢', pinyin: 'xiè xie', en: 'thank you' },
  { hanzi: '我', pinyin: 'wǒ', en: 'I / me' },
  { hanzi: '你', pinyin: 'nǐ', en: 'you' },
  { hanzi: '是', pinyin: 'shì', en: 'to be' },
  { hanzi: '喜欢', pinyin: 'xǐ huān', en: 'to like' },
  { hanzi: '再见', pinyin: 'zài jiàn', en: 'goodbye' },
  { hanzi: '早上好', pinyin: 'zǎo shang hǎo', en: 'good morning' },
  { hanzi: '请问', pinyin: 'qǐng wèn', en: 'may I ask' },
  { hanzi: '对不起', pinyin: 'duì bu qǐ', en: 'sorry' },
];

function toneOf(pinyin: string): number {
  for (const t of TONES) {
    if (t.n > 0 && pinyin.includes(t.mark)) return t.n;
  }
  return 0;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distractors(correct: string, n = 3): string[] {
  const out = new Set<string>();
  while (out.size < n) {
    const d = correct.replace(/([1-4])/, (m) => String(((Number(m) + 1 + Math.floor(Math.random() * 3)) % 4) + 1));
    if (d !== correct) out.add(d);
  }
  return [...out];
}

export default function Pinyin() {
  const [tab, setTab] = useState<'learn' | 'tone' | 'spell'>('learn');
  const [ti, setTi] = useState(0);
  const [toneGuess, setToneGuess] = useState<number | null>(null);
  const [toneScore, setToneScore] = useState(0);
  const [toneDone, setToneDone] = useState(0);
  const [si, setSi] = useState(0);
  const [opts, setOpts] = useState<string[]>([]);
  const [spellGuess, setSpellGuess] = useState<string | null>(null);
  const [spellScore, setSpellScore] = useState(0);
  const [spellDone, setSpellDone] = useState(0);
  const [error, setError] = useState('');

  const logPinyin = async (question: string, answer: string, correct: boolean) => {
    try {
      await db.createRow({
        databaseId: DB_ID,
        tableId: TABLES.quizzes,
        rowId: ID.unique(),
        data: {
          item_type: 'pinyin',
          question,
          answer,
          correct,
          difficulty: 1,
          created_at: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const nextTone = (n: number) => {
    if (toneGuess !== null) return;
    const cur = TONE_POOL[ti];
    const correct = toneOf(cur.pinyin) === n;
    setToneGuess(n);
    setToneDone((d) => d + 1);
    if (correct) setToneScore((s) => s + 1);
    void logPinyin(`${cur.hanzi} (${cur.pinyin})`, `${n === 0 ? 'neutral' : n}${correct ? '' : ' (wrong)'}`, correct);
  };

  const nextSpell = (g: string) => {
    if (spellGuess !== null) return;
    const cur = SPELL_POOL[si];
    const correct = g === cur.pinyin;
    setSpellGuess(g);
    setSpellDone((d) => d + 1);
    if (correct) setSpellScore((s) => s + 1);
    void logPinyin(`spell: ${cur.hanzi}`, `${g}${correct ? '' : ` (was ${cur.pinyin})`}`, correct);
  };

  const startSpell = () => {
    const cur = SPELL_POOL[si];
    setOpts(shuffle([cur.pinyin, ...distractors(cur.pinyin)]));
    setSpellGuess(null);
  };

  const toneCur = TONE_POOL[ti];
  const spellCur = SPELL_POOL[si];

  return (
    <div>
      <h1>Pinyin & Tones</h1>
      {error && <div className="error">{error}</div>}
      <div className="btnrow" style={{ marginBottom: 14 }}>
        <button className={tab === 'learn' ? 'btn sm' : 'btn ghost sm'} onClick={() => setTab('learn')}>Learn</button>
        <button className={tab === 'tone' ? 'btn sm' : 'btn ghost sm'} onClick={() => setTab('tone')}>Tone ID</button>
        <button className={tab === 'spell' ? 'btn sm' : 'btn ghost sm'} onClick={() => setTab('spell')}>Spelling</button>
      </div>

      {tab === 'learn' && (
        <>
          <div className="card">
            <h2>The 4 tones + neutral</h2>
            <p className="muted" style={{ marginTop: 0 }}>Same sound, different tone → different word. Master these early.</p>
            <div className="tonegrid">
              {TONES.map((t) => (
                <div className="tonecard" key={t.n}>
                  <div className="big" style={{ color: t.color }}>{t.mark}</div>
                  <b>{t.name}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{t.desc}</div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ margin: '12px 0 6px' }}>The classic example — hear each one:</p>
            <div className="btnrow">
              {MA_ROW.map((m) => (
                <button key={m.pinyin} className="btn ghost sm" onClick={() => speak(m.hanzi)}>
                  {m.pinyin} <span className="muted">({m.hanzi} {m.meaning})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Initials <span className="muted">(consonants)</span></h2>
            <div className="pinyintable">
              {INITIALS.map((c) => (
                <button key={c.i} className="pinyincell" onClick={() => speak(c.ex)}>
                  <b>{c.i}</b>
                  <span className="muted">{c.ex} · {c.en}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Finals <span className="muted">(vowels + endings)</span></h2>
            <div className="pinyintable">
              {FINALS.map((x) => (
                <button key={x.f} className="pinyincell" onClick={() => speak(x.ex)}>
                  <b>{x.f}</b>
                  <span className="muted">{x.ex}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Spelling rules to remember</h2>
            {RULES.map((r) => (
              <div key={r.t} style={{ marginBottom: 10 }}>
                <b>{r.t}</b>
                <div className="muted">{r.d}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'tone' && (
        <div className="card" style={{ textAlign: 'center', padding: '26px 16px' }}>
          {ti < TONE_POOL.length ? (
            <>
              <p className="muted">Which tone do you hear? 🔊</p>
              <p className="zh" style={{ fontSize: 40, margin: '8px 0 2px' }}>{toneCur.hanzi}</p>
              <button className="speakbtn" style={{ marginBottom: 14 }} onClick={() => speak(toneCur.hanzi)}>🔊 Play again</button>
              <div className="btnrow" style={{ justifyContent: 'center' }}>
                {[1, 2, 3, 4, 0].map((n) => (
                  <button
                    key={n}
                    className="btn"
                    style={{
                      minWidth: 64,
                      opacity: toneGuess !== null && toneGuess !== n ? 0.4 : 1,
                      background: toneGuess === n ? (toneGuess === toneOf(toneCur.pinyin) ? '#2e7d4f' : '#c23b22') : undefined,
                    }}
                    onClick={() => nextTone(n)}
                  >
                    {n === 0 ? 'neutral' : `${n} (${TONES[n - 1].mark})`}
                  </button>
                ))}
              </div>
              {toneGuess !== null && (
                <>
                  <p style={{ marginTop: 12 }}>
                    {toneGuess === toneOf(toneCur.pinyin) ? '✅ Correct!' : `❌ It was tone ${toneOf(toneCur.pinyin)} (${TONES[toneOf(toneCur.pinyin) - 1].mark})`}
                  </p>
                  <button
                    className="btn green"
                    onClick={() => {
                      setToneGuess(null);
                      setTi((i) => i + 1);
                    }}
                  >
                    Next
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 22 }}>Done! {toneScore}/{toneDone} correct</p>
              <button className="btn green" onClick={() => { setTi(0); setToneGuess(null); setToneScore(0); setToneDone(0); }}>Restart</button>
            </>
          )}
        </div>
      )}

      {tab === 'spell' && (
        <div className="card" style={{ textAlign: 'center', padding: '26px 16px' }}>
          {si < SPELL_POOL.length ? (
            <>
              <p className="muted">Hear it, then pick the correct pinyin (tones included!)</p>
              <p className="zh" style={{ fontSize: 40, margin: '8px 0 2px' }}>{spellCur.hanzi}</p>
              <p className="muted">{spellCur.en}</p>
              <button className="speakbtn" style={{ marginBottom: 14 }} onClick={() => speak(spellCur.hanzi)}>🔊 Play</button>
              {opts.length === 0 && (
                <button className="btn green" onClick={startSpell}>Start</button>
              )}
              {opts.length > 0 && (
                <div className="btnrow" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                  {opts.map((o) => (
                    <button
                      key={o}
                      className="btn"
                      style={{
                        opacity: spellGuess !== null && spellGuess !== o ? 0.4 : 1,
                        background: spellGuess === o ? (o === spellCur.pinyin ? '#2e7d4f' : '#c23b22') : undefined,
                      }}
                      onClick={() => nextSpell(o)}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {spellGuess !== null && (
                <>
                  <p style={{ marginTop: 12 }}>
                    {spellGuess === spellCur.pinyin ? '✅ Correct!' : `❌ It was ${spellCur.pinyin}`}
                  </p>
                  <button
                    className="btn green"
                    onClick={() => {
                      setSi((i) => i + 1);
                      setOpts([]);
                      setSpellGuess(null);
                    }}
                  >
                    Next
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 22 }}>Done! {spellScore}/{spellDone} correct</p>
              <button className="btn green" onClick={() => { setSi(0); setSpellGuess(null); setSpellScore(0); setSpellDone(0); setOpts([]); }}>Restart</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}