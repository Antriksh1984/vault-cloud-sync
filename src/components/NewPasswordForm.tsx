import React, { useState } from 'react';
import { confirmResetPassword } from 'aws-amplify/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewPasswordFormProps {
  onMessage: (text: string) => void;
  onPasswordReset: () => void;
  onBack: () => void;
}

const NewPasswordForm = ({ onMessage, onPasswordReset, onBack }: NewPasswordFormProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      onMessage('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      onMessage('Password must be at least 8 characters long.');
      return;
    }

    const resetCode = sessionStorage.getItem('resetCode');
    const resetEmail = sessionStorage.getItem('resetEmail');

    if (!resetCode || !resetEmail) {
      onMessage('Verification session expired. Please try again.');
      onBack();
      return;
    }

    setLoading(true);
    
    try {
      await confirmResetPassword({
        username: resetEmail,
        confirmationCode: resetCode,
        newPassword: password
      });
      
      // Clear session storage
      sessionStorage.removeItem('resetCode');
      sessionStorage.removeItem('resetEmail');
      
      onMessage('Password reset successfully! You can now log in with your new password.');
      onPasswordReset();
    } catch (error: any) {
      onMessage('Failed to reset password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-xl p-8 border border-border">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Create New Password</h2>
        <p className="text-muted-foreground">Enter your new password</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            minLength={8}
          />
        </div>
        
        <div>
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Password must be at least 8 characters long
          </p>
        </div>
        
        <div className="flex flex-col space-y-4">
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="w-full"
          >
            Back
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewPasswordForm;