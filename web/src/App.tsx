import { NavLink, Route, Routes } from 'react-router-dom';
import Today from './pages/Today';
import Pinyin from './pages/Pinyin';
import Lesson from './pages/Lesson';
import Review from './pages/Review';
import Quiz from './pages/Quiz';
import Conversation from './pages/Conversation';
import Speaking from './pages/Speaking';
import Mistakes from './pages/Mistakes';
import Import from './pages/Import';
import Progress from './pages/Progress';

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/pinyin', label: 'Pinyin' },
  { to: '/lesson', label: 'Lesson' },
  { to: '/review', label: 'Review' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/conversation', label: 'Chat' },
  { to: '/speaking', label: 'Speak' },
  { to: '/mistakes', label: 'Fix' },
  { to: '/import', label: 'Import' },
  { to: '/progress', label: 'Progress' },
];

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">中 <small>Mandarin Teacher</small></span>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/pinyin" element={<Pinyin />} />
          <Route path="/lesson" element={<Lesson />} />
          <Route path="/review" element={<Review />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/conversation" element={<Conversation />} />
          <Route path="/speaking" element={<Speaking />} />
          <Route path="/mistakes" element={<Mistakes />} />
          <Route path="/import" element={<Import />} />
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </main>
    </div>
  );
}