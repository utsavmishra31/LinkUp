import '../global.css';

import AuthWrapper from '@/components/AuthWrapper';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// ✅ Configure Google Sign-In ONCE
GoogleSignin.configure({
  webClientId:
    '309673756634-i52dg8q0cr2e80b0i5vk91rf72rhqchm.apps.googleusercontent.com',
  iosClientId:
    '309673756634-fsh3sniau2cpevrf45ffi64sjlbvv33j.apps.googleusercontent.com',
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthWrapper>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>

        <StatusBar style="auto" />
      </AuthWrapper>
    </AuthProvider>
  );
}
