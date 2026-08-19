declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (voice) return voice;
  const voices = window.speechSynthesis.getVoices();
  voice =
    voices.find((v) => v.lang === 'zh-CN' && /xiaoxiao|huihui|yaoyao|azure/i.test(v.name)) ||
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang.startsWith('zh')) ||
    null;
  return voice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voice = null;
    pickVoice();
  };
}

export function speak(text: string, rate = 0.85) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate;
  const v = pickVoice();
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

export function recognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startListening(onResult: (text: string) => void, onEnd: () => void, onError: (msg: string) => void) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    onError('Speech recognition is not supported in this browser. Use Chrome.');
    return null;
  }
  const rec = new Ctor();
  rec.lang = 'zh-CN';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e: any) => {
    const text = e.results[0][0].transcript;
    onResult(text);
  };
  rec.onerror = (e: any) => onError(e.error || 'recognition error');
  rec.onend = () => onEnd();
  try {
    rec.start();
  } catch {
    onError('Could not start microphone. Check Chrome mic permissions.');
  }
  return rec;
}
