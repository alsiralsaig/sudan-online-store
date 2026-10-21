/**
 * Single source of truth for Sanad's public contact details.
 * Everything the platform shows (footer, contact cards, WhatsApp buttons)
 * reads from here so a number never drifts out of sync.
 */

export interface ContactPhone {
  /** E.164 without the plus — used by tel: and wa.me links. */
  raw: string;
  /** How it is shown on screen. */
  display: string;
  label: string;
}

export interface ContactEmail {
  address: string;
  label: string;
}

export interface SocialChannel {
  key: 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'whatsapp';
  name: string;
  handle: string;
  url: string;
  /** Tailwind colour used for the icon chip. */
  accent: string;
  badge: string;
}

export const SANAD_PHONES: ContactPhone[] = [
  { raw: '249966704757', display: '+249 96 670 4757', label: 'الخط الرئيسي' },
  { raw: '249913009060', display: '+249 91 300 9060', label: 'الدعم الفني' },
  { raw: '249114537190', display: '+249 11 453 7190', label: 'المبيعات والاشتراكات' },
];

export const SANAD_EMAILS: ContactEmail[] = [
  { address: 'alsiralsaig@gmail.com', label: 'البريد الرئيسي' },
  { address: 'tajalsir2026@gmail.com', label: 'المبيعات والشراكات' },
];

export const SANAD_SOCIALS: SocialChannel[] = [
  {
    key: 'tiktok',
    name: 'تيك توك',
    handle: '@alsiralsaig2',
    url: 'https://www.tiktok.com/@alsiralsaig2',
    accent: 'text-white',
    badge: 'فيديوهات سريعة',
  },
  {
    key: 'instagram',
    name: 'إنستغرام',
    handle: '@alsir_alsaig1',
    url: 'https://www.instagram.com/alsir_alsaig1',
    accent: 'text-pink-400',
    badge: 'صور وعروض',
  },
  {
    key: 'youtube',
    name: 'يوتيوب',
    handle: '@ParadiseTech_1',
    url: 'https://www.youtube.com/@ParadiseTech_1',
    accent: 'text-red-400',
    badge: 'شروحات مرئية',
  },
  {
    key: 'facebook',
    name: 'فيسبوك',
    handle: 'صفحة منصة سند',
    url: 'https://www.facebook.com/share/1FQj9wqxCv/',
    accent: 'text-blue-400',
    badge: 'مجتمع التجار',
  },
];

/** tel: link for a phone number. */
export const telHref = (raw: string): string => `tel:+${raw}`;

/** WhatsApp chat link, optionally with a ready-made Arabic greeting. */
export const waHref = (
  raw: string,
  message = 'مرحباً بفريق منصة سند، عندي استفسار.'
): string => `https://wa.me/${raw}?text=${encodeURIComponent(message)}`;

/** mailto: link with a subject line. */
export const mailHref = (address: string, subject = 'استفسار عبر منصة سند'): string =>
  `mailto:${address}?subject=${encodeURIComponent(subject)}`;
