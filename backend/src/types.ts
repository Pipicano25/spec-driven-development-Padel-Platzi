import type { Db } from './db.js';
import type { Clock } from './time.js';

export interface User {
  id: number;
  email: string;
}

export interface Court {
  id: string;
  name: string;
}

export interface Slot {
  startHour: number;
  status: 'available' | 'reserved';
  selectable: boolean;
}

export interface ReservationDto {
  id: number;
  courtId: string;
  courtName: string;
  date: string;
  startHour: number;
  endHour: number;
  cancellable: boolean;
}

export interface AppDeps {
  db: Db;
  clock: Clock;
}
