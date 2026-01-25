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
        const inModalGroup = segments[0] === '(modal)';


        if (user) {
            // User is signed in
            if (!profile || (profile && !profile.onboardingCompleted)) {
                // User needs onboarding
                if (!inOnboardingGroup) {
                    router.replace('/(onboarding)/name');
                } else {
                    // Check specific step and redirect if needed
                    // Map step number to route
                    const steps: Record<number, string> = {
                        1: '/(onboarding)/name',
                        2: '/(onboarding)/dob',
                        3: '/(onboarding)/gender',
                        4: '/(onboarding)/looking-for',
                        5: '/(onboarding)/interested-in',
                        6: '/(onboarding)/height',
                        7: '/(onboarding)/availability',
                        8: '/(onboarding)/photos',
                        9: '/(onboarding)/prompts',
                        10: '/(onboarding)/location'
                    };

                    const currentStep = profile?.onboardingStep || 1;
                    const targetRoute = steps[currentStep] || '/(onboarding)/name';

                    // define the route path relative to the app root for comparison
                    // usually useSegments returns array like ["(onboarding)", "name"]
                    // so we construct current path
                    const currentPath = `/${segments.join('/')}`;

                    // Simple check: if we are not on the target route, move there.
                    // Note: This might need more robust path checking if segments vary.
                    if (currentPath !== targetRoute) {
                        // Avoid infinite loops or fighting with navigation if user is consciously moving back?
                        // For strictly linear onboarding, we force them to the latest step.
                        router.replace(targetRoute as any);
                    }
                }
           } else if (profile && profile.onboardingCompleted) {
    if (!inTabsGroup && !inModalGroup) {
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
    const inModalGroup = segments[0] === '(modal)';


    // Prevent rendering protected content if not authenticated
    if (!user && !inAuthGroup) {
        return <View className="flex-1 bg-white" />;
    }

    // Prevent rendering auth content if authenticated but not correctly redirected yet
    if (user && !inTabsGroup && !inOnboardingGroup && !inModalGroup) {
    return (
        <View className="flex-1 bg-white justify-center items-center">
            <ActivityIndicator size="large" color="#000" />
        </View>
    );
}

    return <>{children}</>;
}
