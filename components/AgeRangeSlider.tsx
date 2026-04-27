import React, { useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 4;
const H_PAD = THUMB_SIZE / 2; // horizontal padding so thumb never clips

interface AgeRangeSliderProps {
    minAge?: number;
    maxAge?: number;
    initialLow?: number;
    initialHigh?: number;
    onValuesChange?: (low: number, high: number) => void;
}

export default function AgeRangeSlider({
    minAge = 18,
    maxAge = 80,
    initialLow = 18,
    initialHigh = 45,
    onValuesChange,
}: AgeRangeSliderProps) {
    const [low, setLow] = useState(initialLow);
    const [high, setHigh] = useState(initialHigh);

    React.useEffect(() => {
        setLow(initialLow);
        setHigh(initialHigh);
        lowRef.current = initialLow;
        highRef.current = initialHigh;
    }, [initialLow, initialHigh]);

    const trackWidth = useRef(0);
    const lowRef = useRef(initialLow);
    const highRef = useRef(initialHigh);
    const lowStartPos = useRef(0);
    const highStartPos = useRef(0);

    const valueToPos = (value: number) => {
        const w = trackWidth.current;
        if (w === 0) return 0;
        return ((value - minAge) / (maxAge - minAge)) * w;
    };

    const posToValue = (pos: number) => {
        const w = trackWidth.current;
        if (w === 0) return minAge;
        const ratio = Math.max(0, Math.min(1, pos / w));
        return Math.round(ratio * (maxAge - minAge) + minAge);
    };

    const lowPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                lowStartPos.current = valueToPos(lowRef.current);
            },
            onPanResponderMove: (_, { dx }) => {
                const maxPos = valueToPos(highRef.current) - trackWidth.current * 0.04;
                const clamped = Math.max(0, Math.min(lowStartPos.current + dx, maxPos));
                const val = posToValue(clamped);
                if (val !== lowRef.current) {
                    lowRef.current = val;
                    setLow(val);
                }
            },
            onPanResponderRelease: () => {
                onValuesChange?.(lowRef.current, highRef.current);
            },
        })
    ).current;

    const highPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                highStartPos.current = valueToPos(highRef.current);
            },
            onPanResponderMove: (_, { dx }) => {
                const minPos = valueToPos(lowRef.current) + trackWidth.current * 0.04;
                const clamped = Math.max(minPos, Math.min(highStartPos.current + dx, trackWidth.current));
                const val = posToValue(clamped);
                if (val !== highRef.current) {
                    highRef.current = val;
                    setHigh(val);
                }
            },
            onPanResponderRelease: () => {
                onValuesChange?.(lowRef.current, highRef.current);
            },
        })
    ).current;

    const lowPos = valueToPos(low);
    const highPos = valueToPos(high);

    return (
        <View style={{ width: '100%' }}>
            {/* Value Display */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827' }}>{low}</Text>
                <Text style={{ fontSize: 18, color: '#9CA3AF', marginHorizontal: 8 }}>—</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827' }}>
                    {high}{high === maxAge ? '+' : ''}
                </Text>
            </View>

            {/* Track Wrapper — horizontal padding keeps thumbs inside */}
            <View style={{ paddingHorizontal: H_PAD }}>
                {/* Measure inner track width */}
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
                            left: lowPos,
                            width: Math.max(0, highPos - lowPos),
                            height: TRACK_HEIGHT,
                            backgroundColor: '#111827',
                            borderRadius: TRACK_HEIGHT / 2,
                        }}
                    />

                    {/* Low Thumb */}
                    <View
                        {...lowPanResponder.panHandlers}
                        style={{
                            position: 'absolute',
                            top: 4,
                            left: lowPos - THUMB_SIZE / 2,
                            width: THUMB_SIZE,
                            height: THUMB_SIZE,
                            borderRadius: THUMB_SIZE / 2,
                            backgroundColor: 'white',
                            borderWidth: 2,
                            borderColor: '#111827',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 5,
                            zIndex: 10,
                        }}
                    />

                    {/* High Thumb */}
                    <View
                        {...highPanResponder.panHandlers}
                        style={{
                            position: 'absolute',
                            top: 4,
                            left: highPos - THUMB_SIZE / 2,
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

            {/* Min/Max labels — align with thumb edges */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: H_PAD }}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>{minAge}</Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' }}>{maxAge}+</Text>
            </View>
        </View>
    );
}
