import React, { useState } from 'react';
import { confirmSignUp, confirmResetPassword } from 'aws-amplify/auth';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";

interface VerificationFormProps {
  email: string;
  type: 'signup' | 'resetPassword';
  onMessage: (text: string) => void;
  onVerificationComplete: () => void;
  onBack: () => void;
}

const VerificationForm = ({ email, type, onMessage, onVerificationComplete, onBack }: VerificationFormProps) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      onMessage('Please enter a 6-digit verification code.');
      return;
    }

    setLoading(true);
    
    try {
      if (type === 'signup') {
        await confirmSignUp({ 
          username: email, 
          confirmationCode: code 
        });
        onMessage('Account verified successfully! You can now log in.');
      } else {
        // For reset password, we need to store the code for the next step
        sessionStorage.setItem('resetCode', code);
        sessionStorage.setItem('resetEmail', email);
      }
      onVerificationComplete();
    } catch (error: any) {
      onMessage('Verification failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-xl p-8 border border-border">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          {type === 'signup' ? 'Verify Your Account' : 'Verify Reset Code'}
        </h2>
        <p className="text-muted-foreground">
          Enter the 6-digit code sent to {email}
        </p>
      </div>
      
      <form onSubmit={handleVerify} className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        
        <div className="flex flex-col space-y-4">
          <Button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
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

export default VerificationForm;