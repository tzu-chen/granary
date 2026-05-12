import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ThemeMenu } from '../ThemeMenu/ThemeMenu';
import styles from './Layout.module.css';

interface Props {
  children: ReactNode;
}

type NavSection = 'log' | 'entries' | 'library';

function getActiveSection(pathname: string): NavSection {
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/entries')) return 'entries';
  return 'log';
}

export default function Layout({ children }: Props) {
  const location = useLocation();
  const active = getActiveSection(location.pathname);

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <div className={styles.toggle}>
          <div className={styles.slider} data-active={active} />
          <NavLink to="/" className={styles.toggleOption} data-active={active === 'log'}>Log</NavLink>
          <NavLink to="/entries" className={styles.toggleOption} data-active={active === 'entries'}>Entries</NavLink>
          <NavLink to="/library" className={styles.toggleOption} data-active={active === 'library'}>Library</NavLink>
        </div>
        <ThemeMenu />
      </nav>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
