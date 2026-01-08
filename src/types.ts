
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
    workersNeeded: number;
    workersFilled: number;
    startDate: string;
    location: string;
    coordinates: Coordinates;
    isActive: boolean;
    qrCodeUrl?: string;
    jobStatus?: 'future' | 'active' | 'closed';
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
    status: 'Active' | 'Overdue';
    contactEmail: string;
    logoUrl?: string;
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
    GLOBAL_SEARCH = 'GLOBAL_SEARCH',
    BROADCASTS = 'BROADCASTS',
    SETTINGS_COMPANY = 'SETTINGS_COMPANY'
  }
  
  export enum WorkerTab {
    JOBS = 'JOBS',
    PROFILE = 'PROFILE'
  }
  
  // New Types for Lead Generation & Admin Config
  export interface Lead {
    id: string;
    companyName: string;
    contactName: string;
    phone: string;
    email: string;
    message: string;
    timestamp: string;
    status: 'PENDING' | 'PROCESSED';
  }
  
  export interface AdminConfig {
    whatsappNumber: string;
    notificationEmail: string;
    supportTeam: string;
  }
  