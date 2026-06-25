import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authAPI } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auth flow mode: 'login', '2fa', 'forgot_email', 'forgot_reset'
  const [mode, setMode] = useState('login');
  
  // 2FA state
  const [twoFactorUserId, setTwoFactorUserId] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Forgot Password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { login, isAuthenticated, user, dispatch } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await login(email, password);
      if (data.status === '2fa_required') {
        setTwoFactorUserId(data.userId);
        setMode('2fa');
        showToast('Verification code sent to your email.', 'info');
      } else {
        showToast(`Welcome back, ${data.user.username}!`, 'success');
        if (data.user.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
      showToast('Authentication failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await authAPI.verify2FA(twoFactorUserId, twoFactorCode);
      showToast(`Welcome back, ${data.user.username}!`, 'success');
      
      // Dispatch standard login to local context
      dispatch({
        type: 'LOGIN',
        payload: { token: data.token, user: data.user },
      });

      if (data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid 2FA code. Please try again.');
      showToast('Verification failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!resetEmail) {
      setError('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.forgotPassword(resetEmail);
      showToast('Password reset code sent to your email.', 'info');
      setMode('forgot_reset');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to send reset code. Please verify email.');
      showToast('Reset request failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!resetCode || resetCode.length !== 6) {
      setError('Please enter the 6-digit reset code.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.resetPassword(resetEmail, resetCode, newPassword);
      showToast('Password reset successfully. You can now login.', 'success');
      setMode('login');
      // Reset inputs
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Password reset failed. Check code or try again.');
      showToast('Reset failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setMode('login');
    setError('');
    setTwoFactorCode('');
    setResetCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-teal-100/40 blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-100/40 blur-3xl"></div>

      <div className="max-w-md w-full bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100 p-8 z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 select-none bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            <img src="/logo.png" alt="GRID-INDIA Logo" className="h-14 object-contain" />
          </div>
          <p className="text-sm text-slate-450 mt-2 font-medium">
            Renewable plants data repository portal
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold rounded-2xl flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* RENDER DYNAMIC FLOW FORMS BASED ON STATE */}

        {mode === 'login' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Email / Login ID
              </label>
              <input
                id="login-email"
                type="text"
                placeholder="e.g. user1@energymgmt.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all-300 placeholder:text-slate-300"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-600">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot_email'); setError(''); }}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all-300 placeholder:text-slate-300"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-100 transition-all-300 flex items-center justify-center disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        )}

        {mode === '2fa' && (
          <form onSubmit={handle2FASubmit} className="space-y-5">
            <div className="text-center mb-4">
              <h3 className="text-md font-bold text-slate-700">Enter 2FA Code</h3>
              <p className="text-xs text-slate-450 mt-1">
                We've sent a 6-digit verification code to your email.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Verification Code
              </label>
              <input
                id="2fa-code"
                type="text"
                maxLength="6"
                placeholder="e.g. 123456"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 text-center tracking-[0.5em] font-mono text-lg border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all-300 placeholder:text-slate-300"
              />
            </div>

            <button
              id="2fa-submit"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-100 transition-all-300 flex items-center justify-center disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Verify & Login'
              )}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Back to Login
            </button>
          </form>
        )}

        {mode === 'forgot_email' && (
          <form onSubmit={handleForgotEmailSubmit} className="space-y-5">
            <div className="text-center mb-4">
              <h3 className="text-md font-bold text-slate-700">Forgot Password</h3>
              <p className="text-xs text-slate-450 mt-1">
                Enter your email address to receive a verification reset code.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Email / Login ID
              </label>
              <input
                id="forgot-email"
                type="text"
                placeholder="e.g. user@energymgmt.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all-300 placeholder:text-slate-300"
              />
            </div>

            <button
              id="forgot-email-submit"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-100 transition-all-300 flex items-center justify-center disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Send Reset Code'
              )}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Cancel & Back to Login
            </button>
          </form>
        )}

        {mode === 'forgot_reset' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-md font-bold text-slate-700">Reset Password</h3>
              <p className="text-xs text-slate-450 mt-1">
                Enter the 6-digit code sent to <strong>{resetEmail}</strong> and your new password.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">
                Reset Code
              </label>
              <input
                id="reset-code"
                type="text"
                maxLength="6"
                placeholder="e.g. 123456"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 text-center font-mono tracking-widest text-sm border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all-300 placeholder:text-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all-300 placeholder:text-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none rounded-xl transition-all-300 placeholder:text-slate-300"
              />
            </div>

            <button
              id="reset-password-submit"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-100 transition-all-300 flex items-center justify-center disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Reset Password'
              )}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Back to Login
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Login;
