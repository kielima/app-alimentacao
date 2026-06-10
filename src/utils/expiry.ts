export type ExpiryStatus = 'fresh' | 'soon' | 'expired' | 'no-date';

const SOON_DAYS = 3;

function midnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const today = midnight(new Date());
  const expiry = midnight(new Date(expiryDate + 'T00:00:00'));
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function expiryStatus(expiryDate: string | null | undefined): ExpiryStatus {
  const days = daysUntil(expiryDate);
  if (days === null) return 'no-date';
  if (days < 0) return 'expired';
  if (days <= SOON_DAYS) return 'soon';
  return 'fresh';
}

export function expiryLabel(expiryDate: string | null | undefined): string {
  const days = daysUntil(expiryDate);
  if (days === null) return 'sem validade';

  if (days < 0) {
    const abs = Math.abs(days);
    if (abs === 1) return 'venceu ontem';
    return `venceu há ${abs} dia${abs > 1 ? 's' : ''}`;
  }
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence amanhã';
  if (days <= 30) return `vence em ${days} dias`;
  if (days <= 365) {
    const months = Math.floor(days / 30);
    return `vence em ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  return `vence em ${Math.floor(days / 365)} ano${Math.floor(days / 365) > 1 ? 's' : ''}`;
}

export function statusColor(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'text-red-600 dark:text-red-400';
    case 'soon':
      return 'text-amber-600 dark:text-amber-400';
    case 'fresh':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'no-date':
      return 'text-zinc-500 dark:text-zinc-400';
  }
}

/** Nome do glifo do componente <Icon /> para cada status (null = sem ícone). */
export function statusIcon(status: ExpiryStatus): string | null {
  switch (status) {
    case 'expired':
      return 'x-circle';
    case 'soon':
      return 'alert-triangle';
    case 'fresh':
      return 'check-circle';
    case 'no-date':
      return null;
  }
}

export function statusLabel(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'Vencido';
    case 'soon':
      return 'Vencendo';
    case 'fresh':
      return 'Disponível';
    case 'no-date':
      return 'Sem data';
  }
}
