import './config/amplify';
import React, { useState, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import LoginForm from '@/components/LoginForm';
import SignupForm from '@/components/SignupForm';
import VerificationForm from '@/components/VerificationForm';
import NewPasswordForm from '@/components/NewPasswordForm';
import FileManager from '@/components/FileManager';
import MessageBox from '@/components/MessageBox';
import '@/config/amplify';

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ show: false, text: '' });
  const [authFlow, setAuthFlow] = useState<'login' | 'signup' | 'verify-signup' | 'verify-reset' | 'new-password'>('login');
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = (text: string) => {
    setMessage({ show: true, text });
  };

  const closeMessage = () => {
    setMessage({ show: false, text: '' });
  };

  const handleAuthChange = () => {
    checkAuthState();
  };

  const handleSignupSuccess = (email: string) => {
    setPendingEmail(email);
    setAuthFlow('verify-signup');
  };

  const handleForgotPassword = (email: string) => {
    setPendingEmail(email);
    setAuthFlow('verify-reset');
  };

  const handleVerificationComplete = () => {
    if (authFlow === 'verify-signup') {
      setAuthFlow('login');
      setPendingEmail('');
    } else if (authFlow === 'verify-reset') {
      setAuthFlow('new-password');
    }
  };

  const handlePasswordReset = () => {
    setAuthFlow('login');
    setPendingEmail('');
  };

  const handleBack = () => {
    setAuthFlow('login');
    setPendingEmail('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading CloudVault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-inter">
      {message.show && (
        <MessageBox text={message.text} onClose={closeMessage} />
      )}
      
      {user ? (
        <FileManager onMessage={handleMessage} onAuthChange={handleAuthChange} />
      ) : (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-6xl">
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold text-foreground mb-4">CloudVault</h1>
              <p className="text-xl text-muted-foreground">
                Secure cloud storage for all your files
              </p>
            </div>
            
            {authFlow === 'verify-signup' ? (
              <div className="max-w-md mx-auto">
                <VerificationForm 
                  email={pendingEmail}
                  type="signup"
                  onMessage={handleMessage}
                  onVerificationComplete={handleVerificationComplete}
                  onBack={handleBack}
                />
              </div>
            ) : authFlow === 'verify-reset' ? (
              <div className="max-w-md mx-auto">
                <VerificationForm 
                  email={pendingEmail}
                  type="resetPassword"
                  onMessage={handleMessage}
                  onVerificationComplete={handleVerificationComplete}
                  onBack={handleBack}
                />
              </div>
            ) : authFlow === 'new-password' ? (
              <div className="max-w-md mx-auto">
                <NewPasswordForm 
                  onMessage={handleMessage}
                  onPasswordReset={handlePasswordReset}
                  onBack={handleBack}
                />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <LoginForm 
                  onMessage={handleMessage} 
                  onAuthChange={handleAuthChange}
                  onForgotPassword={handleForgotPassword}
                />
                <SignupForm 
                  onMessage={handleMessage}
                  onSignupSuccess={handleSignupSuccess}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
