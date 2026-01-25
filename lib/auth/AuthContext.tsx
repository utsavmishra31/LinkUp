import { appleSignIn } from '@/lib/auth/appleAuth';
import { googleSignIn } from '@/lib/auth/googleAuth';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import type { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Photo {
    id: string;
    imageUrl: string;
    position: number;
    isPrimary: boolean;
}

export interface Profile {
    id: string;
    userId: string;
    displayName: string | null;
    bio: string | null;
    gender: string | null;
    dob: string | null;
    photos: Photo[];
    onboardingCompleted: boolean;
    onboardingStep: number;
}

type AuthContextType = {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<{ user: User | null } | null>;
    signInWithApple: () => Promise<{ user: User | null } | null>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    signInWithGoogle: async () => null,
    signInWithApple: async () => null,
    signOut: async () => { },
    refreshProfile: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Profile | null>(null);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*, photos(*)')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error);
            } else {
                setProfile(data);
                AsyncStorage.setItem('user_profile', JSON.stringify(data));
            }
        } catch (error) {
            console.error('Error in fetchProfile:', error);
        }
    };

    useEffect(() => {
        // Check current session
        const initializeAuth = async () => {
            try {
                // Load cached profile first
                const cachedProfile = await AsyncStorage.getItem('user_profile');
                if (cachedProfile) {
                    setProfile(JSON.parse(cachedProfile));
                }

                const { data: { session } } = await supabase.auth.getSession();
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await fetchProfile(currentUser.id);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                fetchProfile(currentUser.id);
            } else {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await googleSignIn();
            // Auth state listener will handle the update
            return { user };
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                return null;
            } else if (error.code === statusCodes.IN_PROGRESS) {
                return null;
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                throw new Error('Play services not available');
            } else {
                console.error('Google Sign In Error:', error);
                throw error;
            }
        }
    };

    const signInWithApple = async () => {
        try {
            await appleSignIn();
            // Auth state listener will handle the update
            return { user };
        } catch (error: any) {
            if (error.code === 'ERR_CANCELED' || error.code === 'ERR_CANCELLED') {
                return null;
            }
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            await GoogleSignin.signOut();
            await AsyncStorage.removeItem('user_profile');
            setProfile(null);
            setUser(null);
        } catch (error) {
            console.error('Sign Out Error:', error);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signInWithGoogle,
            signInWithApple,
            signOut,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuthContext = () => useContext(AuthContext);
