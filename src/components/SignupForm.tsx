import React, { useState } from 'react';
import { signUp } from 'aws-amplify/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignupFormProps {
  onMessage: (text: string) => void;
  onSignupSuccess: (email: string) => void;
}

const SignupForm = ({ onMessage, onSignupSuccess }: SignupFormProps) => {
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
      onSignupSuccess(email);
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
          <Label htmlFor="signup-email">Email Address</Label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Password must be at least 8 characters long
          </p>
        </div>
        
        <Button
          type="submit"
          disabled={loading}
          variant="default"
          className="w-full bg-success text-success-foreground hover:bg-success/90"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>
    </div>
  );
};

export default SignupForm;