'use client';

import React from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useStore } from '@/store';
import { Button } from '@/components/ui';
import { Trash2 } from 'lucide-react';

export const DevResetButton: React.FC = () => {
  const auth = useAuth();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleReset = async () => {
    try {
      // 1. Cerrar sesión Firebase
      await auth.signOut();
      
      // 2. Borrar localStorage completo
      localStorage.clear();
      
      // 3. Borrar IndexedDB
      const req1 = indexedDB.deleteDatabase('spendly-db');
      const req2 = indexedDB.deleteDatabase('firebaseLocalStorageDb');
      
      // 4. Limpiar Zustand persist (opcional ya que limpiamos todo localStorage, pero para ser seguros)
      useStore.persist.clearStorage();
      
      // 5. Recargar y redirigir a Landing
      window.location.href = '/';
    } catch (err) {
      console.error('Error al reiniciar aplicación:', err);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        onClick={handleReset} 
        variant="outline" 
        className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40 shadow-lg text-xs h-8 px-3 rounded-full flex items-center gap-2"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Reiniciar aplicación
      </Button>
    </div>
  );
};
