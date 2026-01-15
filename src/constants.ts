
import { Worker, WorkerStatus, Company, MessageTemplate, JobOffer } from './types';

// Rancagua: -34.17083, -70.74444
// Curicó: -34.985, -71.2394
// Santiago: -33.4489, -70.6693
// Talca: -35.4264, -71.6554

export const INITIAL_WORKERS: Worker[] = [
  { id: '1', name: 'Juan Pérez', rut: '12.345.678-9', phone: '+56912345678', region: 'O\'Higgins', status: WorkerStatus.CONSENTED, skills: ['Cosecha', 'Packing'], coordinates: { lat: -34.17083, lng: -70.74444 } },
  { id: '2', name: 'María González', rut: '13.456.789-0', phone: '+56987654321', region: 'Maule', status: WorkerStatus.PENDING, skills: ['Selección'], coordinates: { lat: -34.985, lng: -71.2394 } },
  { id: '3', name: 'Carlos Tapia', rut: '14.567.890-K', phone: '+56911223344', region: 'O\'Higgins', status: WorkerStatus.ACTIVE, skills: ['Cosecha', 'Carga'], coordinates: { lat: -34.17000, lng: -70.74000 } },
  { id: '4', name: 'Ana Silva', rut: '15.678.901-2', phone: '+56955667788', region: 'Valparaíso', status: WorkerStatus.REJECTED, skills: ['Packing'], coordinates: { lat: -33.0472, lng: -71.6127 } },
  { id: '5', name: 'Pedro Morales', rut: '16.789.012-3', phone: '+56999887766', region: 'Maule', status: WorkerStatus.PENDING, skills: ['Manejo Maquinaria'], coordinates: { lat: -35.4264, lng: -71.6554 } },
];

export const MOCK_GLOBAL_WORKERS: Worker[] = [
  { id: 'g1', name: 'Luis Araya', rut: '17.111.222-3', phone: '+56911223344', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Poda', 'Riego'], coordinates: { lat: -34.990, lng: -71.240 } },
  { id: 'g2', name: 'Carmen Soto', rut: '18.222.333-4', phone: '+56922334455', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Packing'], coordinates: { lat: -35.000, lng: -71.250 } },
  { id: 'g3', name: 'Roberto Diaz', rut: '16.444.555-6', phone: '+56933445566', region: 'O\'Higgins', status: WorkerStatus.CONSENTED, skills: ['Tractorista'], coordinates: { lat: -34.180, lng: -70.750 } },
  { id: 'g4', name: 'Elena Varas', rut: '19.555.666-7', phone: '+56944556677', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Cosecha'], coordinates: { lat: -35.430, lng: -71.660 } },
  { id: 'g5', name: 'Felipe Lagos', rut: '20.666.777-8', phone: '+56955667788', region: 'Metropolitana', status: WorkerStatus.CONSENTED, skills: ['Carga'], coordinates: { lat: -33.450, lng: -70.670 } },
  { id: 'g6', name: 'Sofia Mella', rut: '21.777.888-9', phone: '+56966778899', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Poda', 'Cosecha'], coordinates: { lat: -34.980, lng: -71.230 } },
];

export const ENHANCED_DEMO_WORKERS: Worker[] = [
  { id: 'd1', name: 'Ricardo Alarcón', rut: '15.222.333-4', phone: '+56991002233', region: 'O\'Higgins', status: WorkerStatus.ACTIVE, skills: ['Cosecha', 'Tractorista'], coordinates: { lat: -34.170, lng: -70.744 } },
  { id: 'd2', name: 'Patricia Bustos', rut: '16.333.444-5', phone: '+56991002234', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Packing', 'Selección'], coordinates: { lat: -34.985, lng: -71.239 } },
  { id: 'd3', name: 'Marcelo Contreras', rut: '17.444.555-6', phone: '+56991002235', region: 'O\'Higgins', status: WorkerStatus.CONSENTED, skills: ['Cosecha'], coordinates: { lat: -34.175, lng: -70.740 } },
  { id: 'd4', name: 'Daniela Donoso', rut: '18.555.666-7', phone: '+56991002236', region: 'Maule', status: WorkerStatus.ACTIVE, skills: ['Packing'], coordinates: { lat: -34.990, lng: -71.245 } },
  { id: 'd5', name: 'Esteban Espinoza', rut: '19.666.777-8', phone: '+56991002237', region: 'O\'Higgins', status: WorkerStatus.CONSENTED, skills: ['Riego'], coordinates: { lat: -34.180, lng: -70.750 } },
  { id: 'd6', name: 'Francisca Fuenzalida', rut: '12.777.888-9', phone: '+56991002238', region: 'Metropolitana', status: WorkerStatus.CONSENTED, skills: ['Poda'], coordinates: { lat: -33.448, lng: -70.669 } },
  { id: 'd7', name: 'Gonzalo Guzmán', rut: '13.888.999-0', phone: '+56991002239', region: 'Maule', status: WorkerStatus.PENDING, skills: ['Cosecha'], coordinates: { lat: -35.426, lng: -71.655 } },
  { id: 'd8', name: 'Helena Herrera', rut: '14.999.000-K', phone: '+56991002240', region: 'Valparaíso', status: WorkerStatus.CONSENTED, skills: ['Administración'], coordinates: { lat: -33.047, lng: -71.612 } },
  { id: 'd9', name: 'Ignacio Iturra', rut: '10.111.222-1', phone: '+56991002241', region: 'O\'Higgins', status: WorkerStatus.ACTIVE, skills: ['Maquinaria'], coordinates: { lat: -34.172, lng: -70.742 } },
  { id: 'd10', name: 'Javiera Jara', rut: '11.222.333-2', phone: '+56991002242', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Packing'], coordinates: { lat: -34.982, lng: -71.235 } },
  { id: 'd11', name: 'Kevin Lagos', rut: '20.333.444-3', phone: '+56991002243', region: 'Metropolitana', status: WorkerStatus.PENDING, skills: ['Carga'], coordinates: { lat: -33.455, lng: -70.675 } },
  { id: 'd12', name: 'Loreto Mardones', rut: '21.444.555-4', phone: '+56991002244', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Selección'], coordinates: { lat: -35.430, lng: -71.660 } },
  { id: 'd13', name: 'Matías Muñoz', rut: '22.555.666-5', phone: '+56991002245', region: 'O\'Higgins', status: WorkerStatus.CONSENTED, skills: ['Poda'], coordinates: { lat: -34.165, lng: -70.735 } },
  { id: 'd14', name: 'Natalia Núñez', rut: '16.666.777-6', phone: '+56991002246', region: 'Maule', status: WorkerStatus.ACTIVE, skills: ['Cosecha'], coordinates: { lat: -34.975, lng: -71.225 } },
  { id: 'd15', name: 'Oscar Ortiz', rut: '17.777.888-7', phone: '+56991002247', region: 'O\'Higgins', status: WorkerStatus.PENDING, skills: ['Riego'], coordinates: { lat: -34.185, lng: -70.755 } },
  { id: 'd16', name: 'Paola Palma', rut: '18.888.999-8', phone: '+56991002248', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Packing'], coordinates: { lat: -35.420, lng: -71.650 } },
  { id: 'd17', name: 'Quirino Quiroz', rut: '19.999.000-9', phone: '+56991002249', region: 'Metropolitana', status: WorkerStatus.CONSENTED, skills: ['Cosecha'], coordinates: { lat: -33.460, lng: -70.680 } },
  { id: 'd18', name: 'Rosa Rojas', rut: '12.000.111-0', phone: '+56991002250', region: 'O\'Higgins', status: WorkerStatus.ACTIVE, skills: ['Packing'], coordinates: { lat: -34.190, lng: -70.760 } },
  { id: 'd19', name: 'Sebastián Soto', rut: '13.111.222-1', phone: '+56991002251', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Tractorista'], coordinates: { lat: -34.995, lng: -71.250 } },
  { id: 'd20', name: 'Teresa Tapia', rut: '14.222.333-2', phone: '+56991002252', region: 'O\'Higgins', status: WorkerStatus.PENDING, skills: ['Carga'], coordinates: { lat: -34.160, lng: -70.730 } },
];

export const ENHANCED_DEMO_GLOBAL: Worker[] = [
  { id: 'dg1', name: 'Ulises Uribe', rut: '15.333.444-3', phone: '+56992003344', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Poda'], coordinates: { lat: -34.985, lng: -71.239 } },
  { id: 'dg2', name: 'Valentina Vera', rut: '16.444.555-4', phone: '+56992003345', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Cosecha'], coordinates: { lat: -34.988, lng: -71.242 } },
  { id: 'dg3', name: 'William Wallace', rut: '17.555.666-5', phone: '+56992003346', region: 'O\'Higgins', status: WorkerStatus.CONSENTED, skills: ['Maquinaria'], coordinates: { lat: -34.170, lng: -70.744 } },
  { id: 'dg4', name: 'Ximena Xu', rut: '18.666.777-6', phone: '+56992003347', region: 'O\'Higgins', status: WorkerStatus.CONSENTED, skills: ['Packing'], coordinates: { lat: -34.172, lng: -70.746 } },
  { id: 'dg5', name: 'Yaritza Yáñez', rut: '19.777.888-7', phone: '+56992003348', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Selección'], coordinates: { lat: -35.426, lng: -71.655 } },
  { id: 'dg6', name: 'Zacarías Zúñiga', rut: '10.888.999-8', phone: '+56992003349', region: 'Maule', status: WorkerStatus.CONSENTED, skills: ['Riego'], coordinates: { lat: -35.429, lng: -71.658 } },
  { id: 'dg7', name: 'Arturo Prat', rut: '11.999.000-9', phone: '+56992003350', region: 'Metropolitana', status: WorkerStatus.CONSENTED, skills: ['Cosecha'], coordinates: { lat: -33.448, lng: -70.669 } },
  { id: 'dg8', name: 'Bernardo O\'Higgins', rut: '12.111.222-0', phone: '+56992003351', region: 'Metropolitana', status: WorkerStatus.CONSENTED, skills: ['Packing'], coordinates: { lat: -33.450, lng: -70.670 } },
  { id: 'dg9', name: 'Gabriela Mistral', rut: '13.222.333-1', phone: '+56992003352', region: 'Coquimbo', status: WorkerStatus.CONSENTED, skills: ['Cosecha'], coordinates: { lat: -29.953, lng: -71.339 } },
  { id: 'dg10', name: 'Pablo Neruda', rut: '14.333.444-2', phone: '+56992003353', region: 'Valparaíso', status: WorkerStatus.CONSENTED, skills: ['Packing'], coordinates: { lat: -33.047, lng: -71.612 } },
];

export const DEMO_COMPANIES: Company[] = [
  { 
    id: 'c1', 
    name: 'Agrícola Los Andes', 
    subscriptionPlan: 'Pro', 
    status: 'active', 
    isPublic: true,
    contactEmail: 'contacto@losandes.cl',
    logoUrl: 'https://images.unsplash.com/photo-1595856552254-2070f807eb47?q=80&w=200&auto=format&fit=crop'
  },
  { 
    id: 'c2', 
    name: 'Frutos del Valle S.A.', 
    subscriptionPlan: 'Enterprise', 
    status: 'active',
    isPublic: true,
    contactEmail: 'rrhh@frutosvalle.cl',
    logoUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=200&auto=format&fit=crop'
  },
  { 
    id: 'c3', 
    name: 'Exportadora Sol Naciente', 
    subscriptionPlan: 'Basic', 
    status: 'active',
    isPublic: true,
    contactEmail: 'finanzas@solnaciente.cl' 
  },
];

export const PREDEFINED_TEMPLATES: MessageTemplate[] = [
  {
    id: 't1',
    name: 'Solicitud de Consentimiento Estándar',
    content: 'Hola [Nombre], somos AgroConnect. Nos gustaría incluirte en nuestra base de datos para futuras ofertas laborales agrícolas en tu zona. Responde SI para aceptar.',
    type: 'CONSENT'
  },
  {
    id: 't2',
    name: 'Oferta de Cosecha Urgente',
    content: 'Hola [Nombre], Agrícola Los Andes necesita [X] personas para cosecha de cerezas este lunes. Transporte incluido. ¿Te interesa?',
    type: 'JOB_OFFER'
  },
  {
    id: 't3',
    name: 'Oferta de Packing Turno Noche',
    content: 'Hola [Nombre], hay cupos para turno noche en planta de packing. Bono de nocturnidad. Responde para más info.',
    type: 'JOB_OFFER'
  }
];

export const INITIAL_JOBS: JobOffer[] = [
  {
    id: 'j1',
    title: 'Cosecha de Cerezas',
    description: 'Buscamos cosecheros para temporada alta. Se requiere experiencia previa. El trabajo consiste en recolección manual cuidadosa.',
    workersNeeded: 50,
    workersFilled: 32,
    startDate: '2023-11-15',
    location: 'Rancagua, Sector Los Lirios',
    coordinates: { lat: -34.17083, lng: -70.74444 },
    isActive: true,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AgroConnect-Job-j1',
    category: 'Cosecha',
    paymentType: 'Por Kilo',
    jobStatus: 'active',
    benefits: {
      transport: true,
      lunch: true
    },
    transportInfo: 'Bus sale desde Plaza de Rancagua a las 06:30 AM.'
  },
  {
    id: 'j2',
    title: 'Operario de Packing',
    description: 'Selección y embalaje de fruta de exportación. Turno día. Ambiente climatizado.',
    workersNeeded: 20,
    workersFilled: 5,
    startDate: '2023-11-20',
    location: 'Curicó Sur',
    coordinates: { lat: -34.985, lng: -71.2394 },
    isActive: true,
    jobStatus: 'active',
    category: 'Packing',
    paymentType: 'Semanal',
    benefits: {
      transport: true,
      lunch: false
    },
    transportInfo: 'Acercamiento desde paradero 5.'
  },
  {
    id: 'j3',
    title: 'Poda de Arándanos',
    description: 'Trabajo de poda de formación. Se valora certificación.',
    workersNeeded: 10,
    workersFilled: 2,
    startDate: '2023-12-01',
    location: 'Talca',
    coordinates: { lat: -35.4264, lng: -71.6554 },
    isActive: true,
    jobStatus: 'active',
    category: 'Poda',
    paymentType: 'Al Día',
    benefits: {
      transport: false,
      lunch: true
    },
    transportInfo: 'Llegada por medios propios.'
  }
];
