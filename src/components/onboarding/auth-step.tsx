'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Chrome,
  Github,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

// Auth Step Component
export const AuthStep: React.FC<{
  onSuccess: (name: string) => void;
}> = ({ onSuccess }) => {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleEmailAuth = async () => {
    if (!email || (mode !== 'forgot' && !password)) {
      setError('Por favor, completa todos los campos');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (mode === 'forgot') {
        await auth.resetPassword(email);
        setSuccessMessage('¡Correo de recuperación enviado! Revisa tu bandeja de entrada.');
        return;
      }
      
      if (mode === 'login') {
        await auth.signInWithEmail(email, password);
        onSuccess(email.split('@')[0]);
      } else {
        if (!name) {
          setError('Por favor, ingresa tu nombre');
          setIsLoading(false);
          return;
        }
        await auth.signUpWithEmail(email, password, name);
        onSuccess(name);
      }
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError('');
    try {
      await auth.signInWithGoogle();
      onSuccess('Usuario');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google');
      // No llamamos a onSuccess porque falló
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubAuth = async () => {
    setIsLoading(true);
    setError('');
    try {
      await auth.signInWithGithub();
      onSuccess('Usuario');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con GitHub');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleEmailAuth();
    }
  };

  // Forgot Password Mode
  if (mode === 'forgot') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm space-y-5"
      >
        <button
          onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
          className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio de sesión
        </button>

        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-surface-900 dark:text-white">Restablecer contraseña</h3>
          <p className="text-sm text-surface-500">Te enviaremos un enlace de recuperación</p>
        </div>

        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          leftElement={<Mail className="w-4 h-4 text-surface-400" />}
          disabled={isLoading}
          onKeyPress={handleKeyPress}
        />

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {successMessage && (
          <p className="text-sm text-blue-500">{successMessage}</p>
        )}

        <Button
          className="w-full"
          onClick={handleEmailAuth}
          isLoading={isLoading}
        >
          Enviar enlace
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-sm space-y-5"
    >
      {/* Header */}
      <div className="space-y-1 text-center">
        <AnimatePresence mode="wait">
          <motion.h2
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xl font-semibold text-surface-900 dark:text-white"
          >
            {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea una cuenta'}
          </motion.h2>
        </AnimatePresence>
        <p className="text-sm text-surface-500">
          {mode === 'login' ? 'Inicia sesión para continuar' : 'Comienza gratis'}
        </p>
      </div>

      {/* Social Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className={cn(
            "w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl",
            "border border-surface-200 dark:border-surface-700",
            "bg-white dark:bg-surface-800",
            "hover:bg-surface-50 dark:hover:bg-surface-750",
            "text-surface-900 dark:text-white text-sm font-medium",
            "transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Chrome className="w-4 h-4" />
          Continuar con Google
        </button>
        <button
          onClick={handleGithubAuth}
          disabled={isLoading}
          className={cn(
            "w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl",
            "border border-surface-200 dark:border-surface-700",
            "bg-white dark:bg-surface-800",
            "hover:bg-surface-50 dark:hover:bg-surface-750",
            "text-surface-900 dark:text-white text-sm font-medium",
            "transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Github className="w-4 h-4" />
          Continuar con GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
        <span className="text-xs text-surface-400">o</span>
        <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
      </div>

      {/* Form */}
      <div className="space-y-3" onKeyPress={handleKeyPress}>
        <AnimatePresence mode="wait">
          {mode === 'signup' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                leftElement={<User className="w-4 h-4 text-surface-400" />}
                disabled={isLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          leftElement={<Mail className="w-4 h-4 text-surface-400" />}
          disabled={isLoading}
        />

        <Input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          leftElement={<Lock className="w-4 h-4 text-surface-400" />}
          disabled={isLoading}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />
      </div>

      {mode === 'login' && (
        <div className="text-right">
          <button
            onClick={() => { setMode('forgot'); setError(''); }}
            className="text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            disabled={isLoading}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <Button
        className="w-full"
        onClick={handleEmailAuth}
        isLoading={isLoading}
      >
        {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </Button>

      <p className="text-center text-sm text-surface-500">
        {mode === 'login' ? '¿No tienes una cuenta? ' : '¿Ya tienes una cuenta? '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
          className="text-blue-500 font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          disabled={isLoading}
        >
          {mode === 'login' ? 'Regístrate' : 'Iniciar sesión'}
        </button>
      </p>
    </motion.div>
  );
};
