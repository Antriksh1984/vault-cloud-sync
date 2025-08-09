import React, { useState } from 'react';
import { signIn, resetPassword } from 'aws-amplify/auth';

interface LoginFormProps {
  onMessage: (text: string) => void;
  onAuthChange: () => void;
}

const LoginForm = ({ onMessage, onAuthChange }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await signIn({ username: email, password });
      onMessage('Logged in successfully!');
      onAuthChange();
    } catch (error: any) {
      onMessage('Login failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      onMessage('Please enter your email first.');
      return;
    }
    
    try {
      await resetPassword({ username: email });
      onMessage('Reset code sent to your email.');
    } catch (error: any) {
      onMessage('Error: ' + error.message);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-xl p-8 border border-border">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
        <p className="text-muted-foreground">Sign in to your CloudVault account</p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
            placeholder="Enter your password"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <button
          type="button"
          onClick={handleForgotPassword}
          className="w-full text-primary hover:text-primary/80 transition-colors text-sm font-medium"
        >
          Forgot Password?
        </button>
      </form>
    </div>
  );
};

export default LoginForm;