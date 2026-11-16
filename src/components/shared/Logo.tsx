export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="MailMind">
      <rect width="32" height="32" rx="9" fill="#3F4FE0" />
      <path d="M7.5 11.5 16 18l8.5-6.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7.5" y="9.5" width="17" height="13" rx="3" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="24.5" cy="8" r="3.2" fill="#FF8FB8" stroke="#3F4FE0" strokeWidth="1.6" />
    </svg>
  );
}
