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
  subtitle: 'Software engineer living in NYC',
  photoAlt: 'Alan Ton portrait placeholder',
  socialLinks: [
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: '#linkedin',
      isPlaceholder: true,
    },
    {
      id: 'instagram',
      label: 'Instagram',
      href: '#instagram',
      isPlaceholder: true,
    },
  ],
};

/**
 * Declarative configuration for the interactive Three.js calico cat on /home/.
 * Customize the cat's name, hints, or coat palette here without editing 3D scene code.
 */
export const HOME_CAT_CONFIG: HomeCatConfig = {
  name: 'Calico',
  subtitle: 'Say hi',
  desktopHint: 'Stroke over the cat to pet · Drag outside to orbit',
  touchHint: 'Stroke to pet · Drag outside to rotate',
  palette: {
    cream: '#f6f3ed',
    creamShadow: '#ded7cb',
    ginger: '#d47c2b',
    gingerDeep: '#9a4612',
    gingerLight: '#eab05c',
    charcoal: '#1c1814',
    charcoalDeep: '#0d0b09',
    charcoalHighlight: '#8e7754',
    nosePink: '#291d1b',
    earPink: '#ab8684',
    eyeOuter: '#6e8c58',
    eyeInner: '#c7d294',
    cushionBase: '#202b40',
    cushionAccent: '#334666',
  },
};
