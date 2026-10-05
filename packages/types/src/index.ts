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
  year: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  registrationNumber: string | null;
  currentOdometer: number;
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

export type MaintenanceStatus = 'OK' | 'DUE_SOON' | 'OVERDUE';

export interface MaintenanceItem {
  id: string;
  vehicleId: string;
  category: string;
  name: string;
  lastServiceDate: Date | null;
  lastOdometer: number | null;
  nextDueDate: Date | null;
  nextDueOdometer: number | null;
  status: MaintenanceStatus;
  notes: string | null;
}

export interface VehicleServiceRecord {
  id: string;
  vehicleId: string;
  serviceDate: Date;
  odometer: number | null;
  serviceType: string;
  description: string | null;
  workshopName: string | null;
  totalCost: number | null;
  notes: string | null;
  createdAt: Date;
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
