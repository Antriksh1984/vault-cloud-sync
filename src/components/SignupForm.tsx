import React, { useState } from 'react';
import { signUp } from 'aws-amplify/auth';

interface SignupFormProps {
  onMessage: (text: string) => void;
}

const SignupForm = ({ onMessage }: SignupFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await signUp({ 
        username: email, 
        password,
        options: {
          userAttributes: {
            email: email
          }
        }
      });
      onMessage('Verification code sent to your email. Please verify to log in.');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      onMessage('Signup failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-xl p-8 border border-border">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Get Started</h2>
        <p className="text-muted-foreground">Create your CloudVault account</p>
      </div>
      
      <form onSubmit={handleSignup} className="space-y-6">
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-foreground mb-2">
            Email Address
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-foreground mb-2">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
            placeholder="Create a password"
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Password must be at least 8 characters long
          </p>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-success text-success-foreground py-3 rounded-lg hover:bg-success/90 transition-colors font-medium disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
};

export default SignupForm;