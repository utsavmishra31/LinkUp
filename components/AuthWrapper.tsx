import { useAuth } from '@/lib/auth/useAuth';
import { useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const { user, loading, profile } = useAuth();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (loading) return;

        // Hide splash screen once we know the auth state
        SplashScreen.hideAsync();

        const inAuthGroup = segments[0] === '(auth)';
        const inOnboardingGroup = segments[0] === '(onboarding)';
        const inTabsGroup = segments[0] === '(tabs)';

        if (user) {
            // User is signed in
            if (!profile || (profile && !profile.onboardingCompleted)) {
                // User needs onboarding
                if (!inOnboardingGroup) {
                    router.replace('/(onboarding)/name');
                }
            } else if (profile && profile.onboardingCompleted) {
                // User is fully onboarded
                if (!inTabsGroup) {
                    router.replace('/(tabs)');
                }
            }
        } else {
            // User is not signed in
            if (!inAuthGroup) {
                router.replace('/(auth)');
            }
        }
    }, [user, loading, profile, segments]);

    // Show loading screen while checking auth state or profile
    // We only show loading if we have a user but no profile yet (and we are expecting one)
    if (loading) {
        return null; // Don't render anything while splash screen is visible
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inTabsGroup = segments[0] === '(tabs)';

    // Prevent rendering protected content if not authenticated
    if (!user && !inAuthGroup) {
        return <View className="flex-1 bg-white" />;
    }

    // Prevent rendering auth content if authenticated but not correctly redirected yet
    if (user && !inTabsGroup && !inOnboardingGroup) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return <>{children}</>;
}
