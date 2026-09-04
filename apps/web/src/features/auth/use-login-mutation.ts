import { useMutation } from '@tanstack/react-query';
import { login } from '@/lib/api';

export function useLoginMutation() {
  return useMutation({
    mutationFn: login,
  });
}
