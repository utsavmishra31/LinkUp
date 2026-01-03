import { supabase } from '@/lib/supabase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export async function googleSignIn() {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const userInfo = await GoogleSignin.signIn();

    if (!userInfo.idToken) {
        throw new Error('Google ID token not found');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.idToken,
    });

    if (error) throw error;

    return data;
}
