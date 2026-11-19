import React from 'react';

export interface BaseerLogoProps {
  /**
   * 'brand'    -> كربوني + ياقوتي للواجهات (يتكيف تلقائياً مع Light / Dark Mode)
   * 'app-icon' -> أيقونة تطبيق ياقوتية (#2563EB) مع رمز أبيض نقي (#FFFFFF)
   * 'mono'     -> لون موحد يرث currentColor
   */
  variant?: 'brand' | 'app-icon' | 'mono';
  /** عرض الشعار بالبكسل (الافتراضي: 32) */
  size?: number;
  /** إظهار القفل الأفقي مع اسم "بَصير" بخط IBM Plex Sans Arabic */
  showWordmark?: boolean;
  /** استخدام نسخة المقاسات الصغيرة (16px–24px) بفاصل قطري أوسع تلقائياً */
  smallOpticalCut?: boolean;
  className?: string;
}

const MASTER_PATHS = {
  bottomArc: "M 122.99 232.40 C 84.17 233.01 48.27 208.94 31.41 174.40 C 27.11 165.60 21.39 150.85 22.05 141.01 C 23.36 121.71 46.61 111.94 61.01 125.07 C 67.66 131.13 68.37 139.37 70.82 147.51 C 72.90 154.43 76.17 160.73 80.37 166.60 C 98.99 192.59 135.74 199.70 162.64 182.61 C 169.11 178.50 174.81 173.19 179.29 166.97 C 181.03 164.57 182.32 161.73 184.19 159.45 C 186.01 157.22 188.95 156.11 191.70 157.34 C 195.63 159.08 195.57 163.19 194.74 166.76 C 192.95 174.53 190.44 182.17 186.85 189.30 C 174.78 213.23 150.47 231.97 122.99 232.40 Z",
  upperMainArc: "M 196.42 45.81 L 165.56 78.83 C 145.93 63.42 120.96 59.25 98.31 71.12 C 90.77 75.08 84.05 80.46 78.70 87.10 C 76.21 90.20 74.14 95.23 71.31 97.73 C 68.71 100.03 64.72 99.78 62.45 97.13 C 58.75 92.81 62.54 84.64 64.13 80.02 C 69.44 64.54 78.55 50.49 91.28 40.09 C 122.64 14.50 166.74 20.95 196.42 45.81 Z",
  upperAccentSegment: "M 174.19 87.35 L 204.92 54.04 C 218.37 65.06 234.40 96.28 233.99 113.84 C 233.58 131.23 214.31 143.42 198.94 133.98 C 187.94 127.23 188.05 116.59 184.32 105.62 C 182.01 98.85 178.22 93.17 174.19 87.35 Z",
  centerPointer: "M 131.00 162.40 C 102.28 165.01 85.83 131.77 100.90 108.74 C 106.80 99.72 116.88 93.90 127.72 93.86 C 131.23 93.85 134.67 94.79 138.17 94.68 C 146.44 94.42 152.56 87.85 159.11 87.00 C 160.94 86.77 162.79 87.24 164.16 88.51 C 169.57 93.50 161.15 106.56 160.05 112.82 C 158.95 119.14 161.47 125.30 160.83 131.68 C 159.25 147.41 147.05 160.94 131.00 162.40 Z",
} as const;

const SMALL_CUT_PATHS = {
  bottomArc: "M 122.99 232.40 C 84.17 233.01 48.27 208.94 31.41 174.40 C 27.11 165.60 21.39 150.85 22.05 141.01 C 23.36 121.71 46.61 111.94 61.01 125.07 C 67.66 131.13 68.37 139.37 70.82 147.51 C 72.90 154.43 76.17 160.73 80.37 166.60 C 98.99 192.59 135.74 199.70 162.64 182.61 C 169.11 178.50 174.81 173.19 179.29 166.97 C 181.03 164.57 182.32 161.73 184.19 159.45 C 186.01 157.22 188.95 156.11 191.70 157.34 C 195.63 159.08 195.57 163.19 194.74 166.76 C 192.95 174.53 190.44 182.17 186.85 189.30 C 174.78 213.23 150.47 231.97 122.99 232.40 Z",
  upperMainArc: "M 195.34 44.76 L 164.49 77.78 C 144.85 62.38 119.88 58.20 97.23 70.08 C 89.69 74.03 82.98 79.42 77.63 86.05 C 75.14 89.15 73.07 94.19 70.24 96.68 C 67.64 98.98 63.65 98.73 61.38 96.08 C 57.68 91.76 61.46 83.59 63.05 78.97 C 68.37 63.49 77.48 49.44 90.21 39.05 C 121.57 13.45 165.67 19.90 195.34 44.76 Z",
  upperAccentSegment: "M 177.40 90.50 L 208.14 57.18 C 221.59 68.21 237.61 99.43 237.20 116.98 C 236.80 134.37 217.52 146.56 202.15 137.13 C 191.16 130.38 191.27 119.74 187.53 108.76 C 185.23 102.00 181.44 96.32 177.40 90.50 Z",
  centerPointer: "M 131.00 162.40 C 102.28 165.01 85.83 131.77 100.90 108.74 C 106.80 99.72 116.88 93.90 127.72 93.86 C 131.23 93.85 134.67 94.79 138.17 94.68 C 146.44 94.42 152.56 87.85 159.11 87.00 C 160.94 86.77 162.79 87.24 164.16 88.51 C 169.57 93.50 161.15 106.56 160.05 112.82 C 158.95 119.14 161.47 125.30 160.83 131.68 C 159.25 147.41 147.05 160.94 131.00 162.40 Z",
} as const;

/**
 * BaseerLogo — المكون الرسمي الموحد لشعار وهوية تطبيق بَصير (Baseer)
 * دقة متجهة فائقة (Pure Vector Precision) بدون أي تشويه بكسلي على الحواسيب والهواتف.
 */
export const BaseerLogo: React.FC<BaseerLogoProps> = ({
  variant = 'brand',
  size = 32,
  showWordmark = false,
  smallOpticalCut,
  className = '',
}) => {
  const isAppIcon = variant === 'app-icon';
  const isMono = variant === 'mono';
  const useSmallCut = smallOpticalCut ?? size <= 24;
  const paths = useSmallCut ? SMALL_CUT_PATHS : MASTER_PATHS;

  const primaryClass = isAppIcon
    ? 'fill-white'
    : isMono
      ? 'fill-current'
      : 'fill-[#09090B] dark:fill-[#F4F4F5]';

  const accentClass = isAppIcon
    ? 'fill-white'
    : isMono
      ? 'fill-current'
      : 'fill-[#2563EB] dark:fill-[#3B82F6]';

  const svgElement = isAppIcon ? (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="شعار بَصير"
      shapeRendering="geometricPrecision"
      className="shrink-0"
    >
      <rect width="256" height="256" rx="56" fill="#2563EB" />
      <g transform="translate(25.60 25.60) scale(0.8000)">
        <path fill="#FFFFFF" d={paths.bottomArc} />
        <path fill="#FFFFFF" d={paths.upperMainArc} />
        <path fill="#FFFFFF" d={paths.upperAccentSegment} />
        <path fill="#FFFFFF" d={paths.centerPointer} />
      </g>
    </svg>
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="شعار بَصير"
      shapeRendering="geometricPrecision"
      className="shrink-0"
    >
      <path className={primaryClass} d={paths.bottomArc} />
      <path className={primaryClass} d={paths.upperMainArc} />
      <path className={accentClass} d={paths.upperAccentSegment} />
      <path className={accentClass} d={paths.centerPointer} />
    </svg>
  );

  if (!showWordmark) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${isAppIcon ? 'rounded-2xl' : ''} ${className}`}
      >
        {svgElement}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-3 select-none shrink-0 ${className}`}>
      {svgElement}
      <span className="text-2xl font-black tracking-tight leading-none text-zinc-900 dark:text-white">
        بَصير
      </span>
    </span>
  );
};

export default BaseerLogo;
