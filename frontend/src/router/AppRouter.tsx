import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.js';
import { BreakingSessionsPage } from '../pages/BreakingSessionsPage.js';
import { CraftSessionsPage } from '../pages/CraftSessionsPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { PricesPage } from '../pages/PricesPage.js';
import { SimulatorPage } from '../pages/SimulatorPage.js';
import { StockPage } from '../pages/StockPage.js';
import { TradeSessionsPage } from '../pages/TradeSessionsPage.js';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'craft', element: <CraftSessionsPage /> },
      { path: 'brisage', element: <BreakingSessionsPage /> },
      { path: 'trade', element: <TradeSessionsPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'simulateur', element: <SimulatorPage /> },
      { path: 'prix', element: <PricesPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
