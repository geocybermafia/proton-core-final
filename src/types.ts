
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

export type LogEntry = {
  id: string;
  timestamp: number;
  type: 'info' | 'error' | 'warning';
  message: string;
  data?: any;
};

export interface GeminiMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  modelName?: string;
  latency?: number;
}

export type View = 'translator' | 'dashboard' | 'compute' | 'personas' | 'blueprints' | 'profile' | 'settings' | 'image' | 'organizer' | 'device' | 'documentation' | 'market';

export type Task = {
  id: string;
  content: string;
  contentGe?: string;
  completed: boolean;
  isAiSuggested?: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  timestamp?: number;
  description?: string;
  dueDate?: number;
  subtasks?: { id: string; content: string; completed: boolean }[];
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  energyCost?: 'low' | 'medium' | 'high';
  estimatedTime?: number; // in minutes
};

export type Listing = {
  id: string;
  title: string;
  titleGe?: string;
  description: string;
  descriptionGe?: string;
  price: number;
  currency: string;
  sellerId: string;
  sellerName: string;
  image?: string;
  category: string;
  location: string;
  country: string;
  city: string;
  lat?: number;
  lng?: number;
  createdAt: number;
  status: 'active' | 'sold';
};
