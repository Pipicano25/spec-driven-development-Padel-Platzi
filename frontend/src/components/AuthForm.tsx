import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

interface AuthFormProps {
  title: string;
  submitLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  error: string | null;
  pending: boolean;
  onSubmit: (email: string, password: string) => void;
  footer: ReactNode;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200';

// Formulario compartido por las pantallas de inicio de sesión y registro.
export const AuthForm = ({
  title,
  submitLabel,
  passwordAutoComplete,
  error,
  pending,
  onSubmit,
  footer,
}: AuthFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(email, password);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm"
        noValidate
      >
        <div>
          <p className="text-sm font-medium text-emerald-700">Reservas de Pádel</p>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Correo electrónico
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input
            type="password"
            autoComplete={passwordAutoComplete}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Enviando…' : submitLabel}
        </button>

        <p className="text-center text-sm text-slate-600">{footer}</p>
      </form>
    </main>
  );
};
