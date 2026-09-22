import { useCallback, useEffect, useState } from 'react';
import { apiFetch, errorMessage } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, formatHourRange } from '../format';
import type { Reservation } from '../types';

interface MyReservations {
  upcoming: Reservation[];
  history: Reservation[];
}

interface Feedback {
  kind: 'success' | 'error';
  text: string;
}

const ReservationItem = ({
  reservation,
  onCancel,
}: {
  reservation: Reservation;
  onCancel?: (reservation: Reservation) => void;
}) => (
  <li className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="font-semibold text-slate-900">{reservation.courtName}</p>
      <p className="text-sm text-slate-600">
        {formatDate(reservation.date)} · {formatHourRange(reservation.startHour)}
      </p>
    </div>
    {onCancel && reservation.cancellable && (
      <button
        type="button"
        onClick={() => onCancel(reservation)}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Cancelar reserva
      </button>
    )}
  </li>
);

export const MyReservationsPage = () => {
  const [data, setData] = useState<MyReservations | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<MyReservations>('/api/reservations/me'));
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeDialog = useCallback(() => setToCancel(null), []);

  const confirmCancel = async () => {
    if (!toCancel) return;
    setPending(true);
    setFeedback(null);
    try {
      await apiFetch<void>(`/api/reservations/${toCancel.id}`, { method: 'DELETE' });
      setFeedback({ kind: 'success', text: 'Reserva cancelada' });
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setPending(false);
      setToCancel(null);
      await load();
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mis Reservas</h1>

      {feedback && (
        <p
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-sm ${
            feedback.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {!data ? (
        !feedback && <p className="text-slate-500">Cargando reservas…</p>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Próximas</h2>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No tienes reservas próximas</p>
            ) : (
              <ul className="space-y-2">
                {data.upcoming.map((r) => (
                  <ReservationItem key={r.id} reservation={r} onCancel={setToCancel} />
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Historial</h2>
            {data.history.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no tienes reservas pasadas</p>
            ) : (
              <ul className="space-y-2">
                {data.history.map((r) => (
                  <ReservationItem key={r.id} reservation={r} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={toCancel !== null}
        title="Cancelar reserva"
        message={
          toCancel
            ? `¿Cancelar la reserva de ${toCancel.courtName} el ${formatDate(toCancel.date)} a las ${formatHourRange(toCancel.startHour)}?`
            : ''
        }
        confirmLabel="Sí, cancelar"
        pending={pending}
        onConfirm={confirmCancel}
        onCancel={closeDialog}
      />
    </section>
  );
};
