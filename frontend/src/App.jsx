import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import NewSubmissionDrawer from './components/NewSubmissionDrawer.jsx'
import HomePage from './pages/HomePage.jsx'
import SubmissionPage from './pages/SubmissionPage.jsx'
import PolicyQAPage from './pages/PolicyQAPage.jsx'
import EmployeeDirectory from './pages/EmployeeDirectory.jsx'

export default function App() {
  const [showDrawer, setShowDrawer] = useState(false)

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-[#020617]">
        <Sidebar onNewSubmission={() => setShowDrawer(true)} />

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/"                  element={<HomePage />} />
            <Route path="/submissions/:id"   element={<SubmissionPage />} />
            <Route path="/policy"            element={<PolicyQAPage />} />
            <Route path="/employees"         element={<EmployeeDirectory />} />
          </Routes>
        </main>

        {showDrawer && (
          <NewSubmissionDrawer onClose={() => setShowDrawer(false)} />
        )}
      </div>
    </BrowserRouter>
  )
}
