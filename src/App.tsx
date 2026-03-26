import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Ecosystem from './components/Ecosystem';
import Pricing from './components/Pricing';
import ActivityTicker from './components/ActivityTicker';
import StatsBar from './components/StatsBar';
import SectionDivider from './components/SectionDivider';
import CTA from './components/CTA';
import Footer from './components/Footer';
import MyNamesPage from './pages/MyNames';
import ProfilePage from './pages/Profile';
import DocsPage from './pages/Docs';
import AdminLayout from './components/admin/AdminLayout';
import { ToastProvider } from './contexts/ToastContext';
import PageTransition from './components/PageTransition';
import WalletModal from './components/WalletModal';
import { initializeConnectionWatcher, cleanupConnectionWatcher } from './stores/connectionStore';

function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ActivityTicker />
        <HowItWorks />
        <SectionDivider />
        <Ecosystem />
        <SectionDivider />
        <Pricing />
        <StatsBar />
        <CTA />
        <Footer />
      </main>
    </>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Routes location={location}>
      <Route
        path="/"
        element={<LandingPage />}
      />
      <Route
        path="/my-names"
        element={
          <PageTransition pathKey={location.pathname}>
            <MyNamesPage />
          </PageTransition>
        }
      />
      <Route
        path="/name/:name"
        element={
          <PageTransition pathKey={location.pathname}>
            <ProfilePage />
          </PageTransition>
        }
      />
      <Route
        path="/admin"
        element={
          <PageTransition pathKey={location.pathname}>
            <AdminLayout />
          </PageTransition>
        }
      />
      <Route
        path="/docs"
        element={
          <PageTransition pathKey={location.pathname}>
            <DocsPage />
          </PageTransition>
        }
      />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    // Initialize connection watcher on app mount
    initializeConnectionWatcher();
    
    // Cleanup on unmount
    return () => {
      cleanupConnectionWatcher();
    };
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AnimatedRoutes />
        <WalletModal />
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
