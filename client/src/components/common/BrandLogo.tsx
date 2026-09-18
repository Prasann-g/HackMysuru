import React from 'react';

/**
 * ASSET TOGGLE SLOT:
 * To use a custom static asset (SVG, PNG, WebP), set this constant to the asset path
 * (e.g., '/images/civicbridge-crest.svg' or imported asset).
 * When null, BrandLogo renders the high-fidelity inline SVG geometric bridge & crest mark.
 */
export const LOGO_IMAGE_SRC: string | null = null;

export interface BrandLogoProps {
  /**
   * Layout display mode:
   * - 'full': Icon mark + 'CivicBridge' + 'Mysuru City Corporation' subtitle
   * - 'icon-only': Only the geometric bridge emblem mark
   * - 'text-only': Wordmark and optional municipal subtitle
   */
  variant?: 'full' | 'icon-only' | 'text-only';

  /**
   * Scale size:
   * - 'sm': compact (28px mark, 14px text) - ideal for tables/cards
   * - 'md': standard (36px mark, 16px text) - ideal for navigation bars
   * - 'lg': prominent (44px mark, 20px text) - ideal for hero headers/modals
   * - 'xl': display (56px mark, 24px text) - ideal for splash/auth hero
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /** Whether to show the 'Mysuru City Corporation' sub-label in full/text variants */
  showSubtitle?: boolean;

  /** Color scheme adaptation */
  theme?: 'default' | 'monochrome' | 'dark-bg';

  /** Additional classes for container */
  className?: string;

  /** Additional classes for icon container */
  iconClassName?: string;

  /** Additional classes for typography block */
  textClassName?: string;
}

/**
 * CivicBridge Master Brand Logo Component
 *
 * Visual Motifs:
 * - Architectural dual-arch bridge representing civic connection between citizens and municipal authorities
 * - Keystone & civic pillar representing governance integrity
 * - Champagne gold (#C5A059) and enterprise charcoal (#2D3139) palette
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  showSubtitle = true,
  theme = 'default',
  className = '',
  iconClassName = '',
  textClassName = '',
}) => {
  // Dimensions based on size preset
  const sizeMap = {
    sm: { iconBox: 'w-7 h-7', iconSvg: 20, title: 'text-sm font-bold', sub: 'text-[9px] tracking-wider' },
    md: { iconBox: 'w-9 h-9', iconSvg: 26, title: 'text-base font-bold', sub: 'text-[10px] tracking-wider' },
    lg: { iconBox: 'w-11 h-11', iconSvg: 32, title: 'text-lg font-bold', sub: 'text-xs tracking-wider' },
    xl: { iconBox: 'w-14 h-14', iconSvg: 40, title: 'text-xl font-bold', sub: 'text-xs tracking-wider' },
  };

  const currentSize = sizeMap[size];

  const renderIconMark = () => {
    if (LOGO_IMAGE_SRC) {
      return (
        <img
          src={LOGO_IMAGE_SRC}
          alt="CivicBridge Emblem"
          className={`${currentSize.iconBox} object-contain`}
        />
      );
    }

    return (
      <div
        className={`${currentSize.iconBox} rounded-lg flex items-center justify-center transition-transform duration-150 ${
          theme === 'dark-bg'
            ? 'bg-bridge-charcoal-800 border border-bridge-gold-400/40 text-bridge-gold-400 shadow-sm'
            : theme === 'monochrome'
            ? 'bg-bridge-charcoal-800 text-white border border-bridge-charcoal-700'
            : 'bg-gradient-to-b from-white to-bridge-ivory-50 border border-bridge-gold-300 text-bridge-charcoal-800 shadow-bridge-sm'
        } ${iconClassName}`}
        aria-hidden="true"
      >
        <svg
          width={currentSize.iconSvg}
          height={currentSize.iconSvg}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          {/* Foundation & Waterline */}
          <line
            x1="3"
            y1="26"
            x2="29"
            y2="26"
            stroke={theme === 'dark-bg' ? '#C5A059' : '#2D3139'}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Bridge Deck */}
          <path
            d="M4 17C10 16 22 16 28 17"
            stroke={theme === 'dark-bg' ? '#DFBE7A' : '#C5A059'}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Dual Arches (Connecting Citizen to Administration) */}
          <path
            d="M5 26C5 20.5 8 18 11.5 18C15 18 15.5 22 16 26"
            stroke={theme === 'dark-bg' ? '#C5A059' : '#2D3139'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M16 26C16.5 22 17 18 20.5 18C24 18 27 20.5 27 26"
            stroke={theme === 'dark-bg' ? '#C5A059' : '#2D3139'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Central Keystone / Civic Pillar & Crown */}
          <path
            d="M16 8L19.5 13H12.5L16 8Z"
            fill={theme === 'dark-bg' ? '#C5A059' : '#C5A059'}
          />
          <line
            x1="16"
            y1="13"
            x2="16"
            y2="26"
            stroke={theme === 'dark-bg' ? '#C5A059' : '#C5A059'}
            strokeWidth="1.75"
            strokeLinecap="round"
          />

          {/* Subtle Civic Gateway Vertex */}
          <circle
            cx="16"
            cy="6"
            r="1.75"
            fill={theme === 'dark-bg' ? '#DFBE7A' : '#B38F44'}
          />
        </svg>
      </div>
    );
  };

  const renderWordmark = () => {
    const isDark = theme === 'dark-bg';

    return (
      <div className={`flex flex-col text-left ${textClassName}`}>
        <div className="flex items-center gap-0.5">
          <span
            className={`${currentSize.title} tracking-tight leading-none ${
              isDark ? 'text-white' : 'text-bridge-charcoal-900'
            }`}
          >
            Civic
          </span>
          <span
            className={`${currentSize.title} tracking-tight leading-none ${
              isDark ? 'text-bridge-gold-400' : 'text-bridge-gold-600'
            }`}
          >
            Bridge
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`${currentSize.sub} font-semibold uppercase ${
              isDark ? 'text-bridge-gold-300/80' : 'text-bridge-charcoal-500'
            } leading-tight mt-0.5`}
          >
            Mysuru City Corporation
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      aria-label="CivicBridge — Mysuru City Corporation"
    >
      {variant !== 'text-only' && renderIconMark()}
      {variant !== 'icon-only' && renderWordmark()}
    </div>
  );
};
