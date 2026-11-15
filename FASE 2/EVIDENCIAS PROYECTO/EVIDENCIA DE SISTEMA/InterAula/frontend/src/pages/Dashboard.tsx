import AppOverview from '../components/common/AppOverview';
import StudyWelcome from '../components/common/StudyWelcome';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profile.service';
import { learningSpaceService } from '../services/learningSpace.service';
import { tutoringService } from '../services/tutoring.service';
import type { Profile } from '../types/profile';
import type { LearningSpaceOverview } from '../types/learningSpace';
import type { TutoringSession } from '../types/tutoring';
import { getUserDisplayName, formatTutoringDateTime } from '../utils/formatters';
import { nextStudyStep } from '../navigation/guidedNavigation';
import ForYouSection from '../components/recommendations/ForYouSection';
import '../styles/guidedExperience.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [overview, setOverview] = useState<LearningSpaceOverview | null>(null);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setProfile(null); setOverview(null); setSessions([]);
    if (!user) { setLoading(false); return; }
    void Promise.allSettled([
      profileService.getMyProfile(), learningSpaceService.getOverview(),
      tutoringService.getMySessionsAsStudent(), tutoringService.getMySessionsAsTutor(),
    ]).then(([p, o, student, tutor]) => {
      if (!active) return;
      if (p.status === 'fulfilled') setProfile(p.value);
      if (o.status === 'fulfilled') setOverview(o.value);
      const all = [student, tutor].flatMap(result => result.status === 'fulfilled' ? result.value : []);
      const unique = [...new Map(all.map(session => [session.id, session])).values()];
      setSessions(unique.filter(session => session.status === 'accepted' && new Date(session.scheduled_at).getTime() >= Date.now()).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).slice(0, 1));
      if ([p, o, student, tutor].some(result => result.status === 'rejected')) setError('Parte de tu actividad no está disponible. Puedes seguir navegando o reintentar.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, retry]);
  const next = nextStudyStep(overview?.paths || [], overview?.tasks || []);
  const name = getUserDisplayName(profile, user?.user_metadata, user?.email);
  return <div className="ia-guided-page">
    <StudyWelcome name={name}/>
    {error && <div className="ia-guided-notice" role="alert">{error} <button type="button" className="ia-btn-secondary" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    <section className="ia-guided-next" aria-label="Tu siguiente paso" aria-busy={loading}>
      <span className="ia-guided-eyebrow">Tu siguiente paso</span>
      {loading ? <p role="status">Preparando tu inicio…</p> : <><h2 id="home-next-title">{next.title}</h2><p>{next.detail}</p><Link className="ia-btn-primary" to={next.href}>{next.action} →</Link></>}
    </section>
    <AppOverview />
    {sessions[0] && <section className="ia-guided-session" aria-label="Próxima tutoría"><div><span className="ia-guided-eyebrow">Próxima tutoría confirmada</span><p>{formatTutoringDateTime(sessions[0].scheduled_at)}</p></div><Link className="ia-btn-secondary" to="/tutoring?tab=my_classes">Ver mi agenda</Link></section>}
    <div id="para-ti" className="ia-guided-feed"><ForYouSection compact /></div>
    <section className="ia-guided-account" aria-labelledby="home-account-title"><h2 id="home-account-title" className="ia-guided-section-title">Mi cuenta y mis apoyos</h2><div className="ia-guided-inline"><Link to="/profile">Mi perfil</Link><Link to="/learning-space?tab=profile">Mis apoyos para aprender</Link><Link to="/settings">Lectura y apariencia</Link><Link to="/profile?tab=tutoring">Ofrecer tutorías y acreditarme</Link></div></section>
  </div>;
}
