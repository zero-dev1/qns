import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function NotFoundPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6">
        <p className="text-[80px] font-clash font-bold text-white/[0.06] leading-none select-none">404</p>
        <h1 className="font-clash font-semibold text-2xl text-white mt-4 mb-2">Page not found</h1>
        <p className="text-[#555] text-sm mb-8 text-center max-w-xs">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold text-sm transition-colors duration-200"
        >
          Back to home
        </Link>
      </div>
      <Footer />
    </>
  );
}
