export type SocialPlatformId = 'linkedin' | 'instagram';

export interface SocialLinkConfig {
  id: SocialPlatformId;
  label: string;
  href: string;
  isPlaceholder?: boolean;
}

export interface HomeProfileConfig {
  name: string;
  subtitle: string;
  /** Optional photo path/URL; renders a portrait placeholder silhouette when omitted. */
  photoUrl?: string;
  photoAlt: string;
  socialLinks: SocialLinkConfig[];
}

export interface CalicoCoatPalette {
  cream: string;
  creamShadow: string;
  ginger: string;
  gingerDeep: string;
  gingerLight: string;
  charcoal: string;
  charcoalDeep: string;
  charcoalHighlight: string;
  nosePink: string;
  earPink: string;
  eyeOuter: string;
  eyeInner: string;
  cushionBase: string;
  cushionAccent: string;
}

export interface HomeCatConfig {
  /** Optional cat display name shown in the card badge (defaults to "Calico"). */
  name: string;
  /** Subtle secondary caption beside the name badge. */
  subtitle: string;
  /** Interaction hint displayed beneath the 3D viewport on pointer devices. */
  desktopHint: string;
  /** Interaction hint displayed beneath the 3D viewport on coarse/touch viewports. */
  touchHint: string;
  /** Coat and stage color palette tuned for alanton.at's dark slate/sky aesthetic. */
  palette: CalicoCoatPalette;
}

/**
 * Evergreen profile configuration for Alan Ton @ Home (/home/).
 * Update `photoUrl` or `socialLinks[*].href` here without touching view components.
 */
export const HOME_PROFILE_CONFIG: HomeProfileConfig = {
  name: 'Alan Ton',
  subtitle: 'Software Engineer in NYC',
  photoAlt: 'Alan Ton portrait placeholder',
  socialLinks: [
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/alanton/',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      href: 'https://www.instagram.com/alan.ton/',
    },
  ],
};

/**
 * Declarative configuration for the interactive Three.js calico cat on /home/.
 * Customize the cat's name, hints, or coat palette here without editing 3D scene code.
 */
export const HOME_CAT_CONFIG: HomeCatConfig = {
  name: 'Candy',
  subtitle: 'Say hi',
  desktopHint: 'Stroke over Candy to pet · Drag outside to orbit',
  touchHint: 'Stroke to pet · Drag outside to rotate',
  palette: {
    cream: '#f4f0e8',
    creamShadow: '#d8d0c2',
    ginger: '#cd7527',
    gingerDeep: '#8c3f11',
    gingerLight: '#e5a352',
    charcoal: '#1d1915',
    charcoalDeep: '#0e0c0a',
    charcoalHighlight: '#8b7452',
    nosePink: '#2c1f1d',
    earPink: '#927170',
    eyeOuter: '#6b8756',
    eyeInner: '#bec98c',
    cushionBase: '#383b43',
    cushionAccent: '#4f535d',
  },
};
