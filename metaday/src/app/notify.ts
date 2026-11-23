import { toast } from 'sonner';
import { errorMessage } from '@/data/errors.ts';

export function notifyError(error: unknown): void {
  toast.error(errorMessage(error));
}

export function notifySuccess(message: string): void {
  toast.success(message);
}
