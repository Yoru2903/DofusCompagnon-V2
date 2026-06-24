import { NavLink, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Navigation principale">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/craft">Craft</NavLink>
        <NavLink to="/brisage">Brisage</NavLink>
        <NavLink to="/trade">Trade</NavLink>
        <NavLink to="/stock">Stock</NavLink>
        <NavLink to="/simulateur">Simulateur</NavLink>
        <NavLink to="/prix">Prix</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
