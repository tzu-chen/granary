import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ThemeMenu } from '../ThemeMenu/ThemeMenu';
import { LogIcon, EntriesIcon, LibraryIcon } from '../Icons/Icons';
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
  const iconSize = 18;

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <NavLink
          to="/"
          className={`${styles.navLink} ${active === 'log' ? styles.navLinkActive : ''}`}
          aria-label="Log"
          title="Log"
        >
          <LogIcon size={iconSize} />
        </NavLink>
        <NavLink
          to="/entries"
          className={`${styles.navLink} ${active === 'entries' ? styles.navLinkActive : ''}`}
          aria-label="Entries"
          title="Entries"
        >
          <EntriesIcon size={iconSize} />
        </NavLink>
        <NavLink
          to="/library"
          className={`${styles.navLink} ${active === 'library' ? styles.navLinkActive : ''}`}
          aria-label="Library"
          title="Library"
        >
          <LibraryIcon size={iconSize} />
        </NavLink>
        <div className={styles.navSpacer} />
        <ThemeMenu />
      </nav>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
