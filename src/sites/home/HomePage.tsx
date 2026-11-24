import React from 'react';
import { Home, Instagram, Linkedin, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CenteredSubsiteHeader } from '../shared/FloatingHeader';
import { CalicoCatCard } from './components/CalicoCatCard';
import {
  HOME_CAT_CONFIG,
  HOME_PROFILE_CONFIG,
  HomeCatConfig,
  HomeProfileConfig,
  SocialPlatformId,
} from './config/home.config';

const SOCIAL_ICON_BY_ID: Record<SocialPlatformId, LucideIcon> = {
  linkedin: Linkedin,
  instagram: Instagram,
};

interface ProfileAvatarProps {
  photoUrl?: string;
  photoAlt: string;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ photoUrl, photoAlt }) => {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={photoAlt}
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-sky-400/35 object-cover shrink-0"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={photoAlt}
      className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-sky-400/35 bg-gradient-to-br from-sky-500/20 via-slate-900 to-slate-950 flex items-center justify-center shrink-0"
    >
      <User className="h-5 w-5 sm:h-6 sm:w-6 text-sky-300/85" aria-hidden="true" />
    </div>
  );
};

interface HomePageProps {
  profile?: HomeProfileConfig;
  cat?: HomeCatConfig;
}

/**
 * Alan Ton @ Home — Minimal personal profile card and interactive 3D calico cat
 * matching the site's dark slate/sky aesthetic.
 */
export const HomePage: React.FC<HomePageProps> = ({
  profile = HOME_PROFILE_CONFIG,
  cat = HOME_CAT_CONFIG,
}) => {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden">
      {/* Subtle atmospheric glow matching LandingPage and WorkPage */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),transparent_70%)]"
        aria-hidden="true"
      />

      <CenteredSubsiteHeader section="Home" icon={Home} position="sticky" />

      <main className="relative z-10 mx-auto w-full max-w-[624px] space-y-4 px-3.5 pt-4 pb-14 sm:px-6 sm:pt-6">
        <section
          aria-label="Profile"
          className="w-full rounded-2xl border border-slate-800/90 bg-slate-900/75 px-4 py-4 sm:px-5 sm:py-4 backdrop-blur-md shadow-2xl shadow-black/40"
        >
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <ProfileAvatar
                photoUrl={profile.photoUrl}
                photoAlt={profile.photoAlt}
              />

              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white leading-tight">
                  {profile.name}
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-300 leading-snug">
                  {profile.subtitle}
                </p>
              </div>
            </div>

            <nav
              aria-label="Social links"
              className="flex flex-wrap items-center gap-2 sm:shrink-0"
            >
              {profile.socialLinks.map((link) => {
                const Icon = SOCIAL_ICON_BY_ID[link.id];
                const externalProps = link.isPlaceholder
                  ? {
                      title: `${link.label} URL coming soon`,
                      onClick: (e: React.MouseEvent<HTMLAnchorElement>) =>
                        e.preventDefault(),
                    }
                  : {
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    };

                return (
                  <a
                    key={link.id}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/85 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-sky-400/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 whitespace-nowrap"
                    {...externalProps}
                  >
                    <Icon
                      className="h-3.5 w-3.5 text-sky-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{link.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        </section>

        <CalicoCatCard config={cat} />
      </main>
    </div>
  );
};
