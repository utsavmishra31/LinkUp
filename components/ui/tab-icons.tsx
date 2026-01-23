import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
    color: string;
    size?: number;
    focused?: boolean;
    imageUrl?: string | null;
}

export const HomeIcon = ({ color, size = 24, focused }: IconProps) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 1.6L2.4 9.2C2.02222 9.5 1.8 10 1.8 10.5V20.8C1.8 21.4627 2.33726 22 3 22H9C9.66274 22 10.2 21.4627 10.2 20.8V14.8H13.8V20.8C13.8 21.4627 14.3373 22 15 22H21C21.6627 22 22.2 21.4627 22.2 20.8V10.5C22.2 10 21.9778 9.5 21.6 9.2L12 1.6Z"
                fill={focused ? color : 'none'}
                stroke={color}
                strokeWidth={focused ? 0 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
};

export const LikeIcon = ({ color, size = 24, focused }: IconProps) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12.1 6.64391C12.1 6.64391 14.28 2.20391 17.76 2.20391C20.67 2.20391 23 4.54391 23 7.42391C23 13.9139 12.1 21.3539 12.1 21.3539C12.1 21.3539 1.2 13.9139 1.2 7.42391C1.2 4.54391 3.53 2.20391 6.44 2.20391C9.92 2.20391 12.1 6.64391 12.1 6.64391Z"
                fill={focused ? color : 'none'}
                stroke={color}
                strokeWidth={focused ? 0 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
};

export const GlobalIcon = ({ color, size = 24, focused }: IconProps) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M3 3L21 21M21 3L3 21"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
};

export const MessagesIcon = ({ color, size = 24, focused }: IconProps) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M1.94619 9.31543C1.42365 9.14125 1.41953 8.86022 1.95694 8.68108L21.0432 2.31901C21.5716 2.14285 21.8747 2.43866 21.7265 2.95694L16.2733 22.0432C16.1226 22.5716 15.8179 22.5894 15.5945 22.0808L12.0003 14.0001L18.0001 6.00012L10.0002 12.0001L1.94619 9.31543Z"
                fill={focused ? color : color}
                stroke="none"
            />
        </Svg>
    );
};

export const ProfileIcon = ({ color, size = 24, focused, imageUrl }: IconProps) => {
    if (imageUrl) {
        return (
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: focused ? 2 : 1.5,
                borderColor: color,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'white'
            }}>
                <Image
                    source={imageUrl}
                    style={{ width: size, height: size }}
                    contentFit="cover"
                    transition={200}
                />
            </View>
        );
    }
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={focused ? color : 'none'}
            />
            <Circle
                cx="12"
                cy="7"
                r="4"
                stroke={color}
                strokeWidth={focused ? 0 : 2}
                fill={focused ? color : 'none'}
            />
        </Svg>
    );
};
