import { useMutation } from '@tanstack/react-query';
import { registerAccount } from '@/lib/api';

export function useRegisterMutation() {
  return useMutation({
    mutationFn: registerAccount,
  });
}
