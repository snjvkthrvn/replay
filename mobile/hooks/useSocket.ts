import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../services/socket';

export function useSocket() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onReplayConfirmed = () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
    };

    const onSegmentRevealed = () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
    };

    const onReactionAdded = () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['replay'] });
    };

    const onCommentAdded = () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['replay'] });
    };

    const onFriendRequest = () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
    };

    socket.on('replay_confirmed', onReplayConfirmed);
    socket.on('segment_revealed', onSegmentRevealed);
    socket.on('reaction_added', onReactionAdded);
    socket.on('comment_added', onCommentAdded);
    socket.on('friend_request', onFriendRequest);

    return () => {
      socket.off('replay_confirmed', onReplayConfirmed);
      socket.off('segment_revealed', onSegmentRevealed);
      socket.off('reaction_added', onReactionAdded);
      socket.off('comment_added', onCommentAdded);
      socket.off('friend_request', onFriendRequest);
    };
  }, [qc]);
}
