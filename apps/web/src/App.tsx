import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom'
import ApiHealth from './ApiHealth'

function WorkspaceLayout() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <p>Flight Instructor</p>
        <nav aria-label="Main navigation">
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/students">Students</NavLink>
          <NavLink to="/landing-slots">Landing slots</NavLink>
          <NavLink to="/admin">Administration</NavLink>
        </nav>
        <ApiHealth />
      </header>
      <Outlet />
    </>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main id="main-content" tabIndex={-1}>
      <h1>{title}</h1>
      <p>
        This page is a placeholder. Functionality will be added in a later task.
      </p>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <h1>Page not found</h1>
      <Link to="/students">Go to students</Link>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<WorkspaceLayout />}>
        <Route path="/" element={<Navigate to="/students" replace />} />
        <Route path="/login" element={<PlaceholderPage title="Login" />} />
        <Route
          path="/students"
          element={<PlaceholderPage title="Students" />}
        />
        <Route
          path="/students/:studentId"
          element={<PlaceholderPage title="Student details" />}
        />
        <Route
          path="/landing-slots"
          element={<PlaceholderPage title="Landing slots" />}
        />
        <Route
          path="/admin"
          element={<PlaceholderPage title="Administration" />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="/student/:token"
        element={<PlaceholderPage title="Student portal" />}
      />
    </Routes>
  )
}
