import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ThemeMenu } from '../ThemeMenu/ThemeMenu';
import styles from './Layout.module.css';

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <div className={styles.brand}>Granary</div>
        <div className={styles.links}>
          <NavLink to="/" className={({ isActive }) => isActive ? styles.active : ''}>Log</NavLink>
          <NavLink to="/open" className={({ isActive }) => isActive ? styles.active : ''}>Open</NavLink>
          <NavLink to="/review" className={({ isActive }) => isActive ? styles.active : ''}>Review</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? styles.active : ''}>Dashboard</NavLink>
        </div>
        <ThemeMenu />
      </nav>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
