import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import '../../styles/dashboard.css';

export default function AppLayout() {
  return (
    <div className="ia-layout">
      <Navbar />
      <main className="ia-main">
        <Outlet />
      </main>
      <footer className="ia-footer">
        <p style={{ margin: 0 }}>
          <strong>InterAula</strong> — Red de Intercambio Académico y Tutorías Universitarias • 2026
        </p>
      </footer>
    </div>
  );
}
