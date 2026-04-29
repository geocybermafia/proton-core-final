
export type UserProfile = {
  name: string;
  email: string;
  language: 'en' | 'ka';
  region: string;
  notifications: boolean;
  phoneNumber?: string;
  bio?: string;
  avatar?: string;
};

export type GlobalAiSettings = {
  temperature: number;
  enableSearch: boolean;
  enableMaps: boolean;
  zenMode: boolean;
  systemInstruction?: string;
  voice: string;
};

export type Theme = 'proton' | 'light' | 'vibrant' | 'midnight';

export type View = 'dashboard' | 'compute' | 'personas' | 'finance' | 'blueprints' | 'profile' | 'settings' | 'image' | 'organizer' | 'device';
