import { formatHourRange } from '../format';
import type { Slot } from '../types';

interface SlotGridProps {
  slots: Slot[];
  selectedHour: number | null;
  onSelect: (startHour: number) => void;
}

const slotClass = (slot: Slot, selected: boolean): string => {
  if (selected) return 'border-emerald-700 bg-emerald-600 text-white ring-2 ring-emerald-300';
  if (slot.status === 'reserved') return 'border-red-200 bg-red-50 text-red-700';
  if (!slot.selectable) return 'border-slate-200 bg-slate-100 text-slate-400';
  return 'border-emerald-200 bg-white text-slate-800 hover:border-emerald-500 hover:bg-emerald-50';
};

export const SlotGrid = ({ slots, selectedHour, onSelect }: SlotGridProps) => (
  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
    {slots.map((slot) => {
      const selected = slot.startHour === selectedHour;
      return (
        <li key={slot.startHour}>
          <button
            type="button"
            disabled={!slot.selectable}
            aria-disabled={!slot.selectable}
            aria-pressed={selected}
            onClick={() => onSelect(slot.startHour)}
            className={`w-full rounded-lg border px-2 py-3 text-center text-sm transition disabled:cursor-not-allowed ${slotClass(slot, selected)}`}
          >
            <span className="block font-semibold">{formatHourRange(slot.startHour)}</span>
            <span className="block text-xs">
              {slot.status === 'reserved' ? 'Reservado' : 'Disponible'}
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);
