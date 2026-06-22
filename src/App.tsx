import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import BootSequence from './pages/BootSequence';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vault from './pages/Vault';
import Perfil from './pages/Perfil';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { NotificacoesProvider } from './components/Notificacoes';
import UpdateChecker from './components/UpdateChecker';
import "./App.css";

const appWindow = getCurrentWindow();

function AppShell() {
  const { tema } = useTheme();

  return (
    <div
      className={`${tema} flex flex-col h-screen font-sans antialiased overflow-hidden relative transition-colors duration-300`}
      style={{ background: 'var(--c-bg)', color: 'var(--c-text-1)' }}
    >
      {/* BARRA DE TÍTULO */}
      <div data-tauri-drag-region className="absolute top-0 left-0 right-0 h-10 flex items-center justify-end px-4 z-[999] bg-transparent">
        <div className="flex space-x-2">
          <button onClick={() => appWindow.minimize()} className="w-3 h-3 rounded-full bg-zinc-600 hover:bg-zinc-400 focus:outline-none"></button>
          <button onClick={() => appWindow.toggleMaximize()} className="w-3 h-3 rounded-full bg-zinc-600 hover:bg-yellow-400 focus:outline-none"></button>
          <button onClick={() => appWindow.close()} className="w-3 h-3 rounded-full bg-red-600 hover:bg-red-500 focus:outline-none"></button>
        </div>
      </div>

      <UpdateChecker />
      <AuthProvider>
        <NotificacoesProvider>
          <Router>
            <Routes>
              <Route path="/"          element={<BootSequence />} />
              <Route path="/login"     element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vault"     element={<Vault />} />
              <Route path="/perfil"    element={<Perfil />} />
            </Routes>
          </Router>
        </NotificacoesProvider>
      </AuthProvider>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
