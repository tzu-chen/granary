import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './Layout.module.css';

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <div className={styles.brand}>Granary</div>
        <div className={styles.links}>
          <NavLink to="/" className={({ isActive }) => isActive ? styles.active : ''}>Log</NavLink>
          <NavLink to="/review" className={({ isActive }) => isActive ? styles.active : ''}>Review</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? styles.active : ''}>Dashboard</NavLink>
        </div>
        <button className={styles.themeToggle} onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? '☽' : '☀'}
        </button>
      </nav>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
