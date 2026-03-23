import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingReplay, confirmReplay, rerollReplay, getReplayDetail } from '../services/api';

export function usePendingReplay() {
  return useQuery({
    queryKey: ['pending'],
    queryFn: getPendingReplay,
    retry: false,
  });
}

export function useConfirmReplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmReplay,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useRerollReplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rerollReplay,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending'] });
    },
  });
}

export function useReplayDetail(id: string) {
  return useQuery({
    queryKey: ['replay', id],
    queryFn: () => getReplayDetail(id),
    enabled: !!id,
  });
}
