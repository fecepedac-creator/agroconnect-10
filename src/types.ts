
export enum WorkerStatus {
  PENDING = 'PENDIENTE',
  CONSENTED = 'CONSENTIMIENTO_OTORGADO',
  REJECTED = 'RECHAZADO',
  ACTIVE = 'ACTIVO_EN_FAENA',
  UNAVAILABLE = 'NO_DISPONIBLE'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  COMPANY = 'COMPANY',
  WORKER = 'WORKER'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ConsentLog {
  legal_version: string;
  document_key: string;
  accepted_at: string;
  accepted_ip: string;
  acceptance_method: string;
  accepted_summary_type: string;
}

export interface Worker {
  id: string;
  name: string;
  rut: string;
  phone: string;
  region: string;
  status: WorkerStatus;
  skills: string[];
  coordinates?: Coordinates;
  distance?: number; // Calculated field for UI
  consent?: ConsentLog; // New field for legal compliance
}

export interface JobOffer {
  id: string;
  title: string;
  description: string;

  // Draft/Publishing (opcional)
  isDraft?: boolean;
  publishedAt?: string;

  // Campos estructurados mínimos (opcional)
  payMode?: 'Al Día' | 'Semanal' | 'Quincenal' | 'Mensual' | 'Por Kilo' | 'Por Hora' | 'Por Turno' | 'Otro';
  payAmount?: number;
  payDetail?: string; // Ej: $/kg, bono, condiciones
  skillsRequired?: string[];

  // IA (opcional)
  aiSeedNotes?: string;
  aiGeneratedText?: string;

  // Afiche RRSS (opcional) — URLs y metadata generadas por backend
  poster?: {
    activePosterId?: string;
    status?: 'none' | 'generating' | 'ready' | 'error';
    updatedAt?: any;
  };
  aiRequest?: {
    state: 'queued' | 'running' | 'ready' | 'error';
    requestedAt?: any;
    seedNotes?: string;
    errorMessage?: string;
  };
  workersNeeded: number;
  workersFilled: number;
  startDate: string;
  location: string;
  coordinates: Coordinates;
  isActive: boolean;
  qrCodeUrl?: string;
  jobStatus?: 'future' | 'active' | 'closed';
  publishPublic?: boolean;
  // Enhanced Fields
  category?: 'Cosecha' | 'Packing' | 'Poda' | 'Maquinaria' | 'Otros';
  paymentType?: 'Al Día' | 'Semanal' | 'Quincenal' | 'Por Kilo';
  benefits?: {
    transport?: boolean;
    lunch?: boolean;
  };
  transportInfo?: string; // e.g., "Salida Plaza de Armas 06:00 AM"
  otherBenefits?: string; // New: For sunscreen, gloves, etc.
}

export interface Company {
  id: string;
  name: string;
  subscriptionPlan: 'Basic' | 'Pro' | 'Enterprise';
  status?:
    | 'Active'
    | 'Overdue'
    | 'Pending'
    | 'Suspended'
    | 'active'
    | 'inactive'
    | 'pending'
    | 'suspended';
  isPublic?: boolean;
  contactEmail: string;
  logoUrl?: string;
  rut?: string;
  region?: string;
  rubro?: string;
  // Nuevos campos de configuración
  hrName?: string;
  hrPhone?: string;
  hrEmail?: string;
  officialPhone?: string;
  facebookLink?: string;
  instagramLink?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  type: 'CONSENT' | 'JOB_OFFER';
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WORKERS = 'WORKERS',
  JOBS = 'JOBS',
  ADMIN = 'ADMIN',
  AI_REVIEW = 'AI_REVIEW',
  WORKER_PORTAL = 'WORKER_PORTAL',
  WORKER_AUTH = 'WORKER_AUTH',
  GLOBAL_SEARCH = 'GLOBAL_SEARCH',
  BROADCASTS = 'BROADCASTS',
  PUBLISH_OFFER = 'PUBLISH_OFFER',
  SETTINGS_COMPANY = 'SETTINGS_COMPANY',
}

export enum WorkerTab {
  JOBS = 'JOBS',
  PROFILE = 'PROFILE'
}

// New Types for Lead Generation & Admin Config
export interface Lead {
  id: string;
  companyName: string;
  email: string;
  rut: string;
  phone?: string;
  region?: string;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  createdAt?: any;
  updatedAt?: any;
  notes?: string;
}

export interface AdminConfig {
  whatsappNumber: string;
  notificationEmail: string;
  supportTeam: string;
  demoMode?: boolean;
}
