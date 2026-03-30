import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ThemeMenu } from '../ThemeMenu/ThemeMenu';
import styles from './Layout.module.css';

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  const location = useLocation();
  const isEntries = location.pathname.startsWith('/entries');

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <div className={styles.toggle}>
          <div className={styles.slider} data-active={isEntries ? 'entries' : 'log'} />
          <NavLink to="/" className={styles.toggleOption} data-active={!isEntries}>Log</NavLink>
          <NavLink to="/entries" className={styles.toggleOption} data-active={isEntries}>Entries</NavLink>
        </div>
        <ThemeMenu />
      </nav>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
