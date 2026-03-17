import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Ecosystem from './components/Ecosystem';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';
import MyNamesPage from './pages/MyNames';
import ProfilePage from './pages/Profile';
import DocsPage from './pages/Docs';
import AdminLayout from './components/admin/AdminLayout';
import { ToastProvider } from './contexts/ToastContext';
import PageTransition from './components/PageTransition';

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Ecosystem />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <PageTransition>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/my-names" element={<MyNamesPage />} />
            <Route path="/name/:name" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminLayout />} />
            <Route path="/docs" element={<DocsPage />} />
          </Routes>
        </PageTransition>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
