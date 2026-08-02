import { View } from '../types';

export interface CommandRoute {
  id: string;
  keywords: string[];
  view: View;
  uiMode?: 'business' | 'creative' | 'market';
  titleEn: string;
  titleKa: string;
  descriptionEn: string;
  descriptionKa: string;
  category: 'core' | 'ai' | 'creative' | 'business' | 'utility';
}

export const COMMAND_ROUTES: CommandRoute[] = [
  {
    id: 'market',
    keywords: ['market', 'hub', 'shop', 'store', 'trade', 'buy', 'sell', 'items', 'listing', 'მარკეტი', 'მაღაზია', 'ყიდვა', 'გაყიდვა', 'ვაჭრობა'],
    view: 'market-hub',
    uiMode: 'market',
    titleEn: 'Market Hub',
    titleKa: 'მარკეტ ჰაბი',
    descriptionEn: 'Local trading marketplace, listings, and map items',
    descriptionKa: 'ადგილობრივი მარკეტი, განცხადებები და რუკა',
    category: 'business'
  },
  {
    id: 'clips',
    keywords: ['clips', 'video', 'feed', 'reels', 'shorts', 'media', 'play', 'კლიპები', 'ვიდეო', 'ფიდი'],
    view: 'clips',
    titleEn: 'Proton Clips',
    titleKa: 'პროტონ კლიპები',
    descriptionEn: 'Short video feed, AI generated clips, and reels',
    descriptionKa: 'ვიდეო ფიდი, AI კლიპები და რგოლები',
    category: 'creative'
  },
  {
    id: 'personas',
    keywords: ['personas', 'persona', 'chat', 'ai', 'companion', 'assistant', 'bot', 'council', 'agent', 'ჩატი', 'ასისტენტი', 'აგენტი', 'ბოტი', 'საუბარი'],
    view: 'personas',
    titleEn: 'AI Companions & Chat',
    titleKa: 'AI ასისტენტები და ჩატი',
    descriptionEn: 'Chat with specialized AI agents and council entities',
    descriptionKa: 'საუბარი სპეციალიზებულ AI აგენტებთან',
    category: 'ai'
  },
  {
    id: 'creative',
    keywords: ['creative', 'studio', 'art', 'design', 'hub', 'კრეატივი', 'სტუდია', 'დიზაინი', 'ჰაბი'],
    view: 'creative-studio',
    uiMode: 'creative',
    titleEn: 'Creative Studio Hub',
    titleKa: 'კრეატიული სტუდია',
    descriptionEn: 'All visual generation, localization, and copywriting tools',
    descriptionKa: 'ვიზუალური გენერაციის და ლოკალიზაციის ინსტრუმენტები',
    category: 'creative'
  },
  {
    id: 'image',
    keywords: ['image', 'photo', 'picture', 'draw', 'generate image', 'art', 'banner', 'sutra', 'სურათი', 'ფოტო', 'ნახატი', 'გენერაცია'],
    view: 'image',
    uiMode: 'creative',
    titleEn: 'Image Studio',
    titleKa: 'სურათების სტუდია',
    descriptionEn: 'Generate and edit AI visual artwork and photos',
    descriptionKa: 'AI სურათების და ფოტოების გენერაცია',
    category: 'creative'
  },
  {
    id: 'translator',
    keywords: ['translator', 'translate', 'localization', 'language', 'georgian', 'english', 'თარგმნა', 'თარგმანი', 'ენა', 'ლოკალიზაცია'],
    view: 'translator',
    uiMode: 'creative',
    titleEn: 'AI Translator',
    titleKa: 'AI მთარგმნელი',
    descriptionEn: 'Multi-language AI translation and localization tool',
    descriptionKa: 'მრავალენოვანი AI თარგმნა და ლოკალიზაცია',
    category: 'utility'
  },
  {
    id: 'copywriting',
    keywords: ['copywriting', 'copy', 'write', 'writer', 'article', 'content', 'text', 'ტექსტი', 'კოპირაითინგი', 'სტატია'],
    view: 'copywriting',
    uiMode: 'creative',
    titleEn: 'Copywriting Studio',
    titleKa: 'კოპირაიტინგის სტუდია',
    descriptionEn: 'AI content creation and article writer',
    descriptionKa: 'AI ტექსტების და სტატიების გენერაცია',
    category: 'creative'
  },
  {
    id: 'organizer',
    keywords: ['organizer', 'task', 'tasks', 'todo', 'calendar', 'schedule', 'plan', 'დავალებები', 'ორგანიზატორი', 'კალენდარი', 'გეგმა'],
    view: 'organizer',
    titleEn: 'Smart Organizer & Tasks',
    titleKa: 'ორგანიზატორი და დავალებები',
    descriptionEn: 'Task tracking, interactive calendar, and productivity planning',
    descriptionKa: 'დავალებების მართვა და კალენდარი',
    category: 'core'
  },
  {
    id: 'business',
    keywords: ['business', 'hub', 'company', 'enterprise', 'overview', 'dashboard', 'ბიზნესი', 'ჰაბი', 'მართვა'],
    view: 'business-hub',
    uiMode: 'business',
    titleEn: 'Business Hub',
    titleKa: 'ბიზნეს ჰაბი',
    descriptionEn: 'Business management, metrics, and operations dashboard',
    descriptionKa: 'ბიზნესის მართვა და ოპერაციული პანელი',
    category: 'business'
  },
  {
    id: 'blueprints',
    keywords: ['workflow', 'workflows', 'blueprint', 'blueprints', 'automation', 'flow', 'pipeline', 'პროცესები', 'ავტომატიზაცია', 'ნაკადები'],
    view: 'blueprints',
    uiMode: 'business',
    titleEn: 'Workflows & Blueprints',
    titleKa: 'სამუშაო პროცესები',
    descriptionEn: 'Automated workflow builder and multi-step pipelines',
    descriptionKa: 'ავტომატიზირებული სამუშაო ნაკადები',
    category: 'business'
  },
  {
    id: 'settings',
    keywords: ['settings', 'config', 'preference', 'theme', 'language', 'setup', 'options', 'პარამეტრები', 'კონფიგურაცია', 'თემა'],
    view: 'settings',
    titleEn: 'System Settings',
    titleKa: 'სისტემის პარამეტრები',
    descriptionEn: 'Theme customization, AI parameters, and user preferences',
    descriptionKa: 'თემის და AI პარამეტრების მორგება',
    category: 'utility'
  },
  {
    id: 'profile',
    keywords: ['profile', 'cabinet', 'account', 'user', 'me', 'avatar', 'პროფილი', 'კაბინეტი', 'ანგარიში', 'ავატარი'],
    view: 'profile',
    titleEn: 'User Cabinet',
    titleKa: 'მომხმარებლის კაბინეტი',
    descriptionEn: 'User profile, account level, and achievements',
    descriptionKa: 'პროფილი, დონე და მიღწევები',
    category: 'core'
  },
  {
    id: 'finance',
    keywords: ['finance', 'web3', 'crypto', 'wallet', 'money', 'payment', ' balances', 'ფინანსები', 'საფულე', 'კრიპტო'],
    view: 'finance',
    titleEn: 'Web3 Finance Panel',
    titleKa: 'ფინანსური პანელი',
    descriptionEn: 'Crypto wallet balance, transactions, and Web3 panel',
    descriptionKa: 'კრიპტო საფულე და ტრანზაქციები',
    category: 'business'
  },
  {
    id: 'documentation',
    keywords: ['documentation', 'docs', 'guide', 'help', 'info', 'faq', 'დოკუმენტაცია', 'ინსტრუქცია', 'დახმარება'],
    view: 'documentation',
    titleEn: 'Documentation & Guide',
    titleKa: 'დოკუმენტაცია',
    descriptionEn: 'Platform user manual and technical guide',
    descriptionKa: 'პლატფორმის ინსტრუქცია და დოკუმენტაცია',
    category: 'utility'
  }
];

/**
 * Finds matching command routes based on normalized query text.
 */
export function matchCommandRoute(query: string): CommandRoute[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const matches: { route: CommandRoute; score: number }[] = [];

  for (const route of COMMAND_ROUTES) {
    let score = 0;

    // Check exact or partial matches in keywords
    for (const kw of route.keywords) {
      if (kw === normalized) {
        score += 100;
      } else if (normalized.includes(kw)) {
        score += 50;
      } else if (kw.includes(normalized) && normalized.length >= 2) {
        score += 30;
      }
    }

    // Check title matches
    if (route.titleEn.toLowerCase().includes(normalized)) score += 40;
    if (route.titleKa.toLowerCase().includes(normalized)) score += 40;

    if (score > 0) {
      matches.push({ route, score });
    }
  }

  // Sort by highest match score
  matches.sort((a, b) => b.score - a.score);

  return matches.map(m => m.route);
}
