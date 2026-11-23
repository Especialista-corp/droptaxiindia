import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge.tsx';

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-accent text-base font-black leading-none text-accent-foreground"
      >
        M
      </span>
      <span className="text-lg font-extrabold tracking-[0.18em] text-foreground">
        META<span className="text-accent">DAY</span>
      </span>
      <Badge tone="neutral" className="ml-1 text-[10px]">
        BETA 0.1
      </Badge>
      {/* O nome visível (METADAY, BETA 0.1) já forma o nome acessível; isto só acrescenta a ação. */}
      <span className="sr-only"> — ir para o início</span>
    </Link>
  );
}
