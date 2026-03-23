import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="friends"
            options={{
              title: 'Friends',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.bg },
            }}
          />
          <Stack.Screen
            name="replay/[id]"
            options={{
              title: '',
              headerTransparent: true,
              headerShadowVisible: false,
              headerTintColor: colors.accent,
            }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
