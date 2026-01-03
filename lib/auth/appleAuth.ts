import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';

export async function appleSignIn() {
    const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
    });

    if (!credential.identityToken) {
        throw new Error('Apple identity token not found');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
    });

    if (error) throw error;

    return data;
}
