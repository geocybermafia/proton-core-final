
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
};

export type GlobalAiSettings = {
  temperature: number;
  enableSearch: boolean;
  enableMaps: boolean;
  zenMode: boolean;
  systemInstruction?: string;
  voice: string;
};

export type ChatMessage = { role: 'user' | 'model', content: string, timestamp: number };
export type PersonaHistory = { [personaId: string]: ChatMessage[] };

export type Theme = 'proton' | 'light' | 'vibrant' | 'midnight' | 'titanium';

export type View = 'translator' | 'dashboard' | 'compute' | 'personas' | 'finance' | 'blueprints' | 'profile' | 'settings' | 'image' | 'organizer' | 'device' | 'documentation';
