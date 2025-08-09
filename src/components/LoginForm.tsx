import React, { useState } from 'react';
import { signIn, resetPassword } from 'aws-amplify/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  onMessage: (text: string) => void;
  onAuthChange: () => void;
  onForgotPassword: (email: string) => void;
}

const LoginForm = ({ onMessage, onAuthChange, onForgotPassword }: LoginFormProps) => {
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
      onForgotPassword(email);
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
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>
        
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
        
        <Button
          type="button"
          variant="link"
          onClick={handleForgotPassword}
          className="w-full"
        >
          Forgot Password?
        </Button>
      </form>
    </div>
  );
};

export default LoginForm;