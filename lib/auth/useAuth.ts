import { appleSignIn } from '@/lib/auth/appleAuth';
import { googleSignIn } from '@/lib/auth/googleAuth';
import { supabase } from '@/lib/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await googleSignIn();
            return { user }; // Return object for consistency
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // User cancelled the login flow - return null instead of throwing
                return null;
            } else if (error.code === statusCodes.IN_PROGRESS) {
                // Operation is already in progress
                return null;
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                // Play services not available or outdated
                throw new Error('Play services not available');
            } else {
                // Some other error happened
                console.error('Google Sign In Error:', error);
                throw error;
            }
        }
    };

    const signInWithApple = async () => {
        try {
            await appleSignIn();
            return { user }; // Return object for consistency
        } catch (error: any) {
            if (error.code === 'ERR_CANCELED' || error.code === 'ERR_CANCELLED') {
                // User cancelled the login flow - return null instead of throwing
                return null;
            }
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            await GoogleSignin.signOut();
        } catch (error) {
            console.error('Sign Out Error:', error);
        }
    };

    return {
        user,
        loading,
        signInWithGoogle,
        signInWithApple,
        signOut
    };
}
