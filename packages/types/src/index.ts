export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'HYBRID' | 'ELECTRIC';

export type TransmissionType = 'MANUAL' | 'AUTOMATIC' | 'AMT' | 'CVT';

export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  variant: string | null;
  registrationNumber: string | null;
  manufacturingYear: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  /** Date-only (YYYY-MM-DD) column, so it is kept as a string to avoid timezone shifts. */
  purchaseDate: string | null;
  currentOdometer: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseCategory =
  | 'FUEL'
  | 'SERVICE'
  | 'REPAIR'
  | 'INSURANCE'
  | 'PUC'
  | 'ACCESSORY'
  | 'OTHER';

export interface Expense {
  id: string;
  vehicleId: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: Date;
  odometer: number | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * A service record is one workshop visit. The vocabulary intentionally reuses
 * the maintenance categories so a reminder and the record that closes it can be
 * matched by name instead of by free text.
 */
export type ServiceType =
  | 'OIL_CHANGE'
  | 'BRAKE_INSPECTION'
  | 'TYRE_REPLACEMENT'
  | 'BATTERY'
  | 'AIR_FILTER'
  | 'COOLANT'
  | 'GENERAL_SERVICE'
  | 'OTHER';

/** One line of `parts_replaced`. Quantity and cost are optional: garages often give neither. */
export interface ReplacedPart {
  name: string;
  quantity: number | null;
  cost: number | null;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  /** Date-only (YYYY-MM-DD) column, kept as a string so it cannot shift with the timezone. */
  serviceDate: string;
  odometerKm: number | null;
  workshopName: string | null;
  serviceType: ServiceType;
  description: string | null;
  partsReplaced: ReplacedPart[];
  labourCost: number;
  partsCost: number;
  otherCost: number;
  /** Always labour + parts + other, computed by the API and never supplied by the client. */
  totalCost: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Stored column value: where the reminder is in its own life cycle. */
export type ReminderStatus = 'ACTIVE' | 'COMPLETED' | 'DISMISSED';

/**
 * Computed by the API on every read — never stored, because it depends on
 * today's date and on the vehicle's latest odometer. Null for reminders that are
 * no longer ACTIVE, so closed history can never surface as overdue.
 */
export type MaintenanceAlertStatus = 'OVERDUE' | 'UPCOMING' | 'SCHEDULED';

export interface MaintenanceReminder {
  id: string;
  vehicleId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueOdometerKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  lastCompletedDate: string | null;
  lastCompletedOdometerKm: number | null;
  status: ReminderStatus;
  alertStatus: MaintenanceAlertStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceSummary {
  vehicleId: string;
  totalServiceRecords: number;
  totalExpenditure: number;
  lastServiceDate: string | null;
  lastServiceOdometer: number | null;
  activeReminders: number;
  overdueReminders: number;
  upcomingReminders: number;
}

/** Cursor-free offset page: service history is small enough to jump around in. */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AiConversation {
  id: string;
  userId: string;
  vehicleId: string | null;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AiMessageRole = 'user' | 'assistant' | 'system';

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export type QuotationStatus = 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';

export type QuotationItemAssessment =
  | 'NECESSARY'
  | 'REVIEW'
  | 'OPTIONAL'
  | 'POTENTIALLY_OVERPRICED'
  | 'UNKNOWN';

export interface Quotation {
  id: string;
  userId: string;
  vehicleId: string | null;
  fileUrl: string | null;
  status: QuotationStatus;
  rawText: string | null;
  totalAmount: number | null;
  analysis: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  labourCost: number | null;
  tax: number | null;
  total: number | null;
  aiCategory: QuotationItemAssessment | null;
  aiReason: string | null;
  estimatedMin: number | null;
  estimatedMax: number | null;
}
