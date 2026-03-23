import { useQuery } from '@tanstack/react-query';
import { getFeed } from '../services/api';

export function useFeed(segment: string, date?: string) {
  return useQuery({
    queryKey: ['feed', segment, date],
    queryFn: () => getFeed(segment, date),
  });
}
