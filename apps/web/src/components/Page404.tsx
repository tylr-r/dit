import { useEffect, useState } from 'react';
import { Footer } from './Footer';
import './Page404.css';

export function Page404() {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowMessage(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const morseCode404 = {
    '4': '....-',
    '0': '-----',
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="page-404-container">
      <div className="page-404-content">
        <div className={`page-404-title ${showMessage ? 'fade-in' : ''}`}>
          <h1 className="error-code">404</h1>
          <span className="morse-404">
            {morseCode404['4']}
            <span className="space" />
            {morseCode404['0']}
            <span className="space" />
            {morseCode404['4']}
          </span>
        </div>

        <div
          className={`page-404-message ${showMessage ? 'fade-in-delayed' : ''}`}
        >
          <h2>Signal Lost</h2>
        </div>

        <button
          className={`home-button ${showMessage ? 'fade-in-last' : ''}`}
          onClick={handleGoHome}
        >
          <span className="button-text">Tune Back Home</span>
        </button>
      </div>

      <Footer />
    </div>
  );
}
