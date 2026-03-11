import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Ecosystem from './components/Ecosystem';
import Pricing from './components/Pricing';
import RegistrationFlow from './components/RegistrationFlow';
import Footer from './components/Footer';
import MyNamesPage from './pages/MyNames';
import ProfilePage from './pages/Profile';
import DocsPage from './pages/Docs';
import AdminLayout from './components/admin/AdminLayout';

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Ecosystem />
      <Pricing />
      <RegistrationFlow />
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/my-names" element={<MyNamesPage />} />
        <Route path="/name/:name" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminLayout />} />
        <Route path="/docs" element={<DocsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
