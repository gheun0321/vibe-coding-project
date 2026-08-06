type IconProps = { className?: string };

function Base({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconEye({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3.4" />
    </Base>
  );
}

export function IconMic({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 10v4a1 1 0 0 0 1 1h3l4.5 4.2c.6.6 1.5.1 1.5-.7V5.5c0-.8-.9-1.3-1.5-.7L8 9H5a1 1 0 0 0-1 1Z" />
      <path d="M17 9c1 1 1 5 0 6" />
      <path d="M19.5 6.5c2.2 2.2 2.2 8.8 0 11" />
    </Base>
  );
}

export function IconBack({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M15 18l-6-6 6-6" />
    </Base>
  );
}

export function IconRice({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M8 9h8l1.4 10.5A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-2.5L8 9Z" />
      <path d="M9.5 9c-.3-2.6 1-4.5 2.5-4.5s2.8 1.9 2.5 4.5" />
    </Base>
  );
}

export function IconWater({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 3c3 4 6 7.8 6 11a6 6 0 1 1-12 0c0-3.2 3-7 6-11Z" />
    </Base>
  );
}

export function IconVeg({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 21c-3.5-2-6-5.4-6-9.5C6 7 9 4 12 4s6 3 6 7.5c0 4.1-2.5 7.5-6 9.5Z" />
      <path d="M12 4c0-1.2.9-2.3 2.2-2.3" />
    </Base>
  );
}

export function IconFruit({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 6.5V4" />
      <path d="M12 4c0-1 .8-1.8 2-1.8" />
    </Base>
  );
}

export function IconDaily({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M6 8h12l1 12H5L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </Base>
  );
}

export function IconSnack({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="9" cy="10" r="1" />
      <circle cx="14" cy="9" r="1" />
      <circle cx="15" cy="14" r="1" />
      <circle cx="10" cy="15" r="1" />
    </Base>
  );
}

export function IconMed({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </Base>
  );
}

export function IconOther({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="M13 7l4 4" />
    </Base>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l3 3 5-6" />
    </Base>
  );
}

export function IconCalendarToday({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 9h18" />
      <path d="M8 3v4M16 3v4" />
      <circle cx="12" cy="16" r="2" />
    </Base>
  );
}

export function IconCalendarTomorrow({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 9h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M9.5 16h5M12.5 13.5l2.5 2.5-2.5 2.5" />
    </Base>
  );
}

export function IconCalendarPick({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 9h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="M12 13v6M9 16h6" />
    </Base>
  );
}

export function IconCash({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <circle cx="12" cy="13" r="3" />
    </Base>
  );
}

export function IconCard({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </Base>
  );
}

export function IconSpeaker({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 9v6h4l5 5V4L8 9H4Z" />
      <path d="M16 8.5c1.3 1 1.3 6 0 7" />
      <path d="M18.7 6c2.2 2.4 2.2 9.6 0 12" />
    </Base>
  );
}

export function IconSpeakerOff({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 9v6h4l5 5V4L8 9H4Z" />
      <path d="M4 4l16 16" />
    </Base>
  );
}
