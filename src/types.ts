
export type UserProfile = {
  id?: string;
  name: string;
  email: string;
  language: 'en' | 'ka';
  region: string;
  notifications: boolean;
  phoneNumber?: string;
  bio?: string;
  avatar?: string;
  role?: string;
  balance?: number;
  isPro?: boolean;
};

export type GlobalAiSettings = {
  temperature: number;
  enableSearch: boolean;
  enableMaps: boolean;
  zenMode: boolean;
  systemInstruction?: string;
  voice: string;
};

export type ChatMessage = { id: string, role: 'user' | 'model', content: string, timestamp: number };
export type PersonaHistory = { [personaId: string]: ChatMessage[] };

export type Persona = {
  id: string;
  name: string;
  nameGe: string;
  role: string;
  description: string;
  descriptionGe: string;
  systemInstruction: string;
  avatar: string;
  language: 'English' | 'Georgian' | 'Mixed';
};

export type WorkflowStep = {
  id: string;
  label: string;
  description: string;
};

export type Workflow = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  personaId: string;
  analysisHistory?: { timestamp: number; result: string }[];
  nodes?: any[];
  edges?: any[];
  steps?: WorkflowStep[];
  status?: 'active' | 'inactive';
  lastRun?: number;
  description?: string;
};

export type Theme = 'proton' | 'light' | 'vibrant' | 'midnight' | 'titanium' | 'forest' | 'sunset' | 'rose';

export type View = 'translator' | 'dashboard' | 'compute' | 'personas' | 'finance' | 'blueprints' | 'profile' | 'settings' | 'image' | 'organizer' | 'device' | 'documentation';
