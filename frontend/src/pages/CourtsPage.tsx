import { useCallback, useEffect, useState } from 'react';
import { apiFetch, errorMessage } from '../api';
import { SlotGrid } from '../components/SlotGrid';
import { formatDate, formatHourRange } from '../format';
import type { BookingWindow, Court, Reservation, Slot } from '../types';

interface Feedback {
  kind: 'success' | 'error';
  text: string;
}

export const CourtsPage = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [dateRange, setDateRange] = useState<BookingWindow | null>(null);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    apiFetch<{ courts: Court[]; bookingWindow: BookingWindow }>('/api/courts')
      .then(({ courts, bookingWindow }) => {
        setCourts(courts);
        setDateRange(bookingWindow);
        setCourtId(courts[0]?.id ?? null);
        setDate(bookingWindow.firstDate);
      })
      .catch((err) => setFeedback({ kind: 'error', text: errorMessage(err) }));
  }, []);

  const loadSlots = useCallback(async () => {
    if (!courtId || !date) return;
    setLoadingSlots(true);
    try {
      const data = await apiFetch<{ slots: Slot[] }>(
        `/api/courts/${encodeURIComponent(courtId)}/availability?date=${encodeURIComponent(date)}`,
      );
      setSlots(data.slots);
    } catch (err) {
      setSlots([]);
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setLoadingSlots(false);
    }
  }, [courtId, date]);

  useEffect(() => {
    setSelectedHour(null);
    loadSlots();
  }, [loadSlots]);

  const changeCourt = (id: string) => {
    setFeedback(null);
    setCourtId(id);
  };

  const changeDate = (value: string) => {
    if (!dateRange || value < dateRange.firstDate || value > dateRange.lastDate) return;
    setFeedback(null);
    setDate(value);
  };

  const selectSlot = (hour: number) => {
    setFeedback(null);
    setSelectedHour(hour);
  };

  const confirmReservation = async () => {
    if (!courtId || !date || selectedHour === null || pending) return;
    setPending(true);
    setFeedback(null);
    try {
      const { reservation } = await apiFetch<{ reservation: Reservation }>('/api/reservations', {
        method: 'POST',
        body: { courtId, date, startHour: selectedHour },
      });
      setFeedback({
        kind: 'success',
        text: `Reserva confirmada: ${reservation.courtName}, ${formatDate(reservation.date)}, ${formatHourRange(reservation.startHour)}`,
      });
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setPending(false);
      setSelectedHour(null);
      await loadSlots();
    }
  };

  const selectedCourt = courts.find((court) => court.id === courtId);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Canchas</h1>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          1. Elige una cancha
        </h2>
        <div className="flex flex-wrap gap-2">
          {courts.map((court) => (
            <button
              key={court.id}
              type="button"
              aria-pressed={court.id === courtId}
              onClick={() => changeCourt(court.id)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                court.id === courtId
                  ? 'border-emerald-700 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {court.name}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          2. Elige una fecha
        </span>
        <input
          type="date"
          value={date ?? ''}
          min={dateRange?.firstDate}
          max={dateRange?.lastDate}
          onChange={(e) => changeDate(e.target.value)}
          className="block rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <span className="block text-xs text-slate-500">
          Puedes reservar con hasta 7 días de anticipación.
        </span>
      </label>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          3. Elige un horario
        </h2>
        {loadingSlots && slots.length === 0 ? (
          <p className="text-slate-500">Cargando horarios…</p>
        ) : (
          <SlotGrid slots={slots} selectedHour={selectedHour} onSelect={selectSlot} />
        )}
      </div>

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

      {selectedHour !== null && selectedCourt && date && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{selectedCourt.name}</span> · {formatDate(date)} ·{' '}
            {formatHourRange(selectedHour)}
          </p>
          <button
            type="button"
            onClick={confirmReservation}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Reservando…' : 'Confirmar reserva'}
          </button>
        </div>
      )}
    </section>
  );
};
