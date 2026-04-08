import { create } from 'zustand';

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  variant: 'destructive' | 'default';
  onConfirm: () => void;
  openConfirm: (opts: {
    title: string;
    description?: string;
    confirmText?: string;
    variant?: 'destructive' | 'default';
    onConfirm: () => void;
  }) => void;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  open: false,
  title: '',
  description: '',
  confirmText: 'Ya, Hapus',
  variant: 'destructive',
  onConfirm: () => {},
  openConfirm: (opts) =>
    set({
      open: true,
      title: opts.title,
      description: opts.description || 'Tindakan ini tidak bisa dibatalkan.',
      confirmText: opts.confirmText || 'Ya, Hapus',
      variant: opts.variant || 'destructive',
      onConfirm: opts.onConfirm,
    }),
  closeConfirm: () => set({ open: false }),
}));
