import React, { useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 4;
const H_PAD = THUMB_SIZE / 2;

interface DistanceSliderProps {
    minDist?: number;
    maxDist?: number;
    initialValue?: number;
    onValueChange?: (value: number) => void;
}

export default function DistanceSlider({
    minDist = 1,
    maxDist = 155,
    initialValue = 50,
    onValueChange,
}: DistanceSliderProps) {
    const [value, setValue] = useState(initialValue);

    React.useEffect(() => {
        setValue(initialValue);
        valueRef.current = initialValue;
    }, [initialValue]);
    const trackWidth = useRef(0);
    const valueRef = useRef(initialValue);
    const startPos = useRef(0);

    const valueToPos = (v: number) => {
        const w = trackWidth.current;
        if (w === 0) return 0;
        return ((v - minDist) / (maxDist - minDist)) * w;
    };

    const posToValue = (pos: number) => {
        const w = trackWidth.current;
        if (w === 0) return minDist;
        const ratio = Math.max(0, Math.min(1, pos / w));
        return Math.round(ratio * (maxDist - minDist) + minDist);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                startPos.current = valueToPos(valueRef.current);
            },
            onPanResponderMove: (_, { dx }) => {
                const clamped = Math.max(0, Math.min(startPos.current + dx, trackWidth.current));
                const val = posToValue(clamped);
                if (val !== valueRef.current) {
                    valueRef.current = val;
                    setValue(val);
                }
            },
            onPanResponderRelease: () => {
                onValueChange?.(valueRef.current);
            },
        })
    ).current;

    const currentPos = valueToPos(value);

    return (
        <View style={{ width: '100%' }}>
            {/* Value Display */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827' }}>
                    {value}{value === maxDist ? '+' : ''}
                </Text>
                <Text style={{ fontSize: 16, color: '#9CA3AF', marginLeft: 8 }}>km</Text>
            </View>

            <View style={{ paddingHorizontal: H_PAD }}>
                <View
                    style={{ position: 'relative', height: THUMB_SIZE + 8 }}
                    onLayout={(e) => {
                        trackWidth.current = e.nativeEvent.layout.width;
                    }}
                >
                    {/* Background track */}
                    <View
                        style={{
                            position: 'absolute',
                            top: THUMB_SIZE / 2 + 4 - TRACK_HEIGHT / 2,
                            left: 0,
                            right: 0,
                            height: TRACK_HEIGHT,
                            backgroundColor: '#E5E7EB',
                            borderRadius: TRACK_HEIGHT / 2,
                        }}
                    />

                    {/* Active track */}
                    <View
                        style={{
                            position: 'absolute',
                            top: THUMB_SIZE / 2 + 4 - TRACK_HEIGHT / 2,
                            left: 0,
                            width: currentPos,
                            height: TRACK_HEIGHT,
                            backgroundColor: '#111827',
                            borderRadius: TRACK_HEIGHT / 2,
                        }}
                    />

                    {/* Thumb */}
                    <View
                        {...panResponder.panHandlers}
                        style={{
                            position: 'absolute',
                            top: 4,
                            left: currentPos - THUMB_SIZE / 2,
                            width: THUMB_SIZE,
                            height: THUMB_SIZE,
                            borderRadius: THUMB_SIZE / 2,
                            backgroundColor: '#111827',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 5,
                            zIndex: 10,
                        }}
                    />
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: H_PAD }}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>{minDist} km</Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>{maxDist}+ km</Text>
            </View>
        </View>
    );
}
