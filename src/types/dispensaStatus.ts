export type DispensaStatus = 'dispensa' | 'comprar' | 'backlog' | 'verificar';

export const DISPENSA_STATUSES: { value: DispensaStatus; label: string; icon: string }[] = [
  { value: 'dispensa', label: 'Dispensa', icon: 'check-circle' },
  { value: 'comprar', label: 'Comprar', icon: 'shopping-cart' },
  { value: 'backlog', label: 'Backlog', icon: 'archive' },
  { value: 'verificar', label: 'Verificar', icon: 'help-circle' },
];

export function dispensaStatusLabel(status: DispensaStatus | undefined): string {
  return DISPENSA_STATUSES.find((s) => s.value === (status ?? 'backlog'))?.label ?? 'Backlog';
}
