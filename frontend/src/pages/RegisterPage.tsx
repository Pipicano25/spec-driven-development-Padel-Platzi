import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { AuthForm } from '../components/AuthForm';
import { useAuth } from '../useAuth';

const MIN_PASSWORD_LENGTH = 8;

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (email: string, password: string) => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setPending(true);
    try {
      await register(email, password);
      navigate('/canchas', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthForm
      title="Crear cuenta"
      submitLabel="Crear cuenta"
      passwordAutoComplete="new-password"
      error={error}
      pending={pending}
      onSubmit={handleSubmit}
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-emerald-700 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    />
  );
};
