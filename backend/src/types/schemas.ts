import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const spotifyCallbackSchema = z.object({
  code: z.string().min(1),
});

export const deviceTokenSchema = z.object({
  fcmToken: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
  notificationPreferences: z.object({
    capture: z.boolean(),
    reveal: z.boolean(),
    reaction: z.boolean(),
    comment: z.boolean(),
    friendRequest: z.boolean(),
  }).optional(),
});

export const friendRequestSchema = z.object({
  username: z.string().min(1),
});

export const reactionSchema = z.object({
  emoji: z.enum(['fire', 'heart', 'laughing', 'music', 'eyes', 'raised_hands']),
});

export const commentSchema = z.object({
  text: z.string().min(1).max(500),
});
