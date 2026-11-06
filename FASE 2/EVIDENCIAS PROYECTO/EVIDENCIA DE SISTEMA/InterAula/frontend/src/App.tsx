import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CalmModeProvider } from './context/CalmModeContext';
import AppRouter from './router/AppRouter';

export default function App() {
  return (
    <BrowserRouter>
      <CalmModeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </CalmModeProvider>
    </BrowserRouter>
  );
}
