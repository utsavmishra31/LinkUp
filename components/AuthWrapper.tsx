import { useAuth } from '@/app/authFirebase/useAuth';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === 'authFirebase';
        const inTabsGroup = segments[0] === '(tabs)';

        if (user && !inTabsGroup) {
            // User is signed in but not in tabs, redirect to dashboard
            router.replace('/(tabs)');
        } else if (!user && !inAuthGroup) {
            // User is not signed in but not in auth, redirect to auth
            router.replace('/authFirebase');
        }
    }, [user, loading, segments]);

    // Show loading screen while checking auth state
    if (loading) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    const inAuthGroup = segments[0] === 'authFirebase';

    // Prevent rendering protected content if not authenticated
    if (!user && !inAuthGroup) {
        return <View className="flex-1 bg-white" />;
    }

    return <>{children}</>;
}
