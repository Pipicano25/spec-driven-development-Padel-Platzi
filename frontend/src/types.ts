export interface User {
  id: number;
  email: string;
}

export interface Court {
  id: string;
  name: string;
}

export interface BookingWindow {
  firstDate: string;
  lastDate: string;
}

export interface Slot {
  startHour: number;
  status: 'available' | 'reserved';
  selectable: boolean;
}

export interface Reservation {
  id: number;
  courtId: string;
  courtName: string;
  date: string;
  startHour: number;
  endHour: number;
  cancellable: boolean;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
}
