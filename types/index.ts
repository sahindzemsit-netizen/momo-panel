export interface Vehicle {
  id: number | string;
  name: string;
  plate: string;
  chassisNumber?: string;
  country?: 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece';
  forcedPhysicalCountry?: 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece' | null;
  isRetired?: boolean;
  status?: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';
  transmission?: 'Automatic' | 'Manual';
  statusColor?: string;
  statusNote?: string;
  displayOrder?: number;
  color?: string;
  createdAt?: number;
  updatedAt?: number;
  isExtra?: boolean;
  extraName?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseId: string;
  passportId: string;
  rentalCount: number;
  totalDaysRented: number;
  totalSpent: number;
  createdAt: number;
  gender?: 'male' | 'female';
  avatar?: string;
}

export interface Reservation {
  id: string;
  clientId?: string;
  vehicleId: number | string;
  name: string;
  email?: string;
  phone?: string;
  start: Date;
  end: Date;
  days: number;
  totalPrice: number;
  amountPaid: number;
  status: 'PENDING' | 'UPCOMING' | 'ON RENT' | 'COMPLETED' | 'CANCELLED';
  note?: string;
  arrivalTime?: string;
  departureTime?: string;
  cancellationReason?: string;
  processedBy?: string;
  passportId?: string;
  driverLicenseId?: string;
  cashflowNotificationSent?: boolean;
  cashflowHandledBy?: string;
  paidTo?: string;
  paymentMethod?: string;
  cashAmount?: number;
  cardAmount?: number;
  isKilometerProcessed?: boolean;
  fromLocation?: string;
  toLocation?: string;
  countries?: string[];
  insurance?: {
    type: '800' | '2000' | '5000';
    price: number;
    squares: number;
    color: string;
  };
  uploadedDocuments?: {
    url: string;
    name: string;
    uploadedAt: number;
    type: string;
  }[];
  createdAt?: number;
  updatedAt?: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: 'Cash' | 'Card';
  timestamp: number;
  note?: string;
  processedBy?: string;
}

export interface Stats {
  totalCancelledValue: number;
  totalCompletedValue: number;
  cancelledCount: number;
  completedCount: number;
  activeVehiclesCount?: number;
  updatedAt: number;
}

export interface DayBooking {
  id: string;
  client: string;
  startDate: Date;
  endDate: Date;
  startMs?: number;
  endMs?: number;
  status: string;
  color: string;
  totalPrice?: number | string;
  arrivalTime?: string;
  departureTime?: string;
}

export interface CarBooking {
  carId: number | string;
  reservations: DayBooking[];
}

export interface RentalRegistration {
  id: string;
  vehicleId: number | string;
  vehicleName: string;
  plate: string;
  expiryDate?: Date;
  startDate?: Date;
}

export interface Car {
  id: string;
  vehicleId: number | string;
  name: string;
  plate: string;
  transmission: 'Automatic' | 'Manual' | string;
  odometer: number;
  recentKm?: number;
  lastOilChangeDate?: string;
  oilChangeHistory?: string[];
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  status: 'PENDING' | 'PAID';
  teammate: string;
  currency?: 'EUR' | 'MKD';
  createdAt: number;
  updatedAt: number;
}

export interface Violation {
  id: string;
  vehicleId: number | string;
  vehicleName: string;
  plate: string;
  datetime: string;
  link: string;
  status: 'waiting' | 'successful';
  price?: number;
  clientName?: string;
  clientId?: string;
  createdAt: number;
  updatedAt: number;
}



