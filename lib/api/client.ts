import { Platform } from 'react-native';

const LOCALHOST = Platform.select({
    ios: 'http://localhost:5000',
    android: 'http://10.0.2.2:5000',
    default: 'http://localhost:5000',
});

export const API_URL = process.env.EXPO_PUBLIC_API_URL || LOCALHOST;
