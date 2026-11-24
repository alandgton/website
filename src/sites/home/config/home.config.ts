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
