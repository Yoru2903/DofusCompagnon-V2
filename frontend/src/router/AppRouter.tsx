import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.js';
import { HomePage } from '../pages/HomePage.js';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
