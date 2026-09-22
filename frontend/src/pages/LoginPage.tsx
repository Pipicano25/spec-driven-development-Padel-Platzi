import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { AuthForm } from '../components/AuthForm';
import { useAuth } from '../useAuth';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (email: string, password: string) => {
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      navigate('/canchas', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthForm
      title="Iniciar sesión"
      submitLabel="Iniciar sesión"
      passwordAutoComplete="current-password"
      error={error}
      pending={pending}
      onSubmit={handleSubmit}
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-medium text-emerald-700 hover:underline">
            Regístrate
          </Link>
        </>
      }
    />
  );
};
