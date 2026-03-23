import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFriends, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, searchUsers } from '../services/api';

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => getFriends(),
  });
}

export function usePendingRequests() {
  return useQuery({
    queryKey: ['friends', 'pending'],
    queryFn: () => getFriends('PENDING'),
  });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useAcceptFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useRejectFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useSearchUsers(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => searchUsers(q),
    enabled: q.length >= 2,
  });
}
