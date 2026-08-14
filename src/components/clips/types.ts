import { Clip, ClipComment, ClipIssue, MarketplaceItem, Order } from '../../types';

export interface PresetLoop {
  id: string;
  nameEn: string;
  nameGe: string;
  url: string;
  sound: string;
}

export const PRESET_LOOPS: PresetLoop[] = [
  {
    id: 'potter-clay',
    nameEn: 'Handmade Pottery Wheel Spin',
    nameGe: 'ხელით ნაკეთი თიხის ჭურჭლის დაზგა',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-potter-shaping-a-clay-vase-41584-large.mp4',
    sound: 'Relaxing Artisan Studio • Ambient Clay Lofi'
  },
  {
    id: 'tbilisi-craft',
    nameEn: 'Tbilisi Artisan Wood & Leather Crafting',
    nameGe: 'თბილისური ტყავისა და ხის ოსტატობა',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-hands-sewing-a-leather-piece-41589-large.mp4',
    sound: 'Georgian Folk Guitar • Craft Beats 2026'
  },
  {
    id: 'coffee-roast',
    nameEn: 'Specialty Coffee Pour-Over in Mtatsminda',
    nameGe: 'ყავის მოხალვა და მოდუღება მთაწმინდაზე',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-making-coffee-with-a-french-press-41595-large.mp4',
    sound: 'Morning Tbilisi Jazz • Cozy Vibes'
  },
  {
    id: 'wool-knitting',
    nameEn: 'Tusheti Sheep Wool Handmade Socks',
    nameGe: 'თუშური ცხვრის მატყლის ჭრელი წინდები',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-knitting-with-needles-and-wool-yarn-41588-large.mp4',
    sound: 'Highlands Melodies • Tusheti Mountains'
  }
];

export function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
