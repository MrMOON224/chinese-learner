import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Lesson from './pages/Lesson';
import Review from './pages/Review';
import Quiz from './pages/Quiz';
import Conversation from './pages/Conversation';
import Speaking from './pages/Speaking';
import Progress from './pages/Progress';

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/lesson', label: 'Lesson' },
  { to: '/review', label: 'Review' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/conversation', label: 'Chat' },
  { to: '/speaking', label: 'Speak' },
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/lesson" element={<Lesson />} />
          <Route path="/review" element={<Review />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/conversation" element={<Conversation />} />
          <Route path="/speaking" element={<Speaking />} />
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </main>
    </div>
  );
}
