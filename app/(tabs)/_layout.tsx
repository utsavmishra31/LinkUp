import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import {
  GlobalIcon,
  HomeIcon,
  LikeIcon,
  MessagesIcon,
  ProfileIcon,
} from '@/components/ui/tab-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthContext } from '@/lib/auth/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { profile } = useAuthContext();
  const primaryPhoto = profile?.photos?.find((p: any) => p.position === 0) || profile?.photos?.[0];

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/${path}`;
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#000000',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 88,
          borderTopWidth: 0.2,
          borderTopColor: '#e5e7eb', // gray-200
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <HomeIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="like"
        options={{
          title: 'Likes',
          tabBarIcon: ({ color, focused }) => (
            <LikeIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="global"
        options={{
          title: 'Global',
          tabBarIcon: ({ color, focused }) => (
            <GlobalIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <MessagesIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <ProfileIcon
              color={color}
              focused={focused}
              imageUrl={getImageUrl(primaryPhoto?.imageUrl)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
