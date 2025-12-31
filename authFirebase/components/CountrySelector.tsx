import { countries, Country } from '@/constants/countries';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CountrySelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (country: Country) => void;
    selectedCountry: Country;
}

export default function CountrySelector({ visible, onClose, onSelect, selectedCountry }: CountrySelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCountries = countries.filter(country =>
        country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.dial_code.includes(searchQuery)
    );

    const renderItem = ({ item }: { item: Country }) => (
        <TouchableOpacity
            className={`flex-row items-center border-b border-gray-100 py-4 px-4 ${selectedCountry.code === item.code ? 'bg-gray-50' : ''
                }`}
            onPress={() => {
                onSelect(item);
                onClose();
            }}
        >
            <Text className="text-3xl mr-4">{item.flag}</Text>
            <View className="flex-1">
                <Text className={`text-base ${selectedCountry.code === item.code ? 'font-bold text-black' : 'font-medium text-gray-800'}`}>
                    {item.name}
                </Text>
            </View>
            <Text className="text-gray-500 font-medium">
                {item.dial_code}
            </Text>
            {selectedCountry.code === item.code && (
                <Ionicons name="checkmark" size={20} color="black" style={{ marginLeft: 12 }} />
            )}
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1">
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                        <Text className="text-xl font-bold text-black">Select Country</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                            <Ionicons name="close" size={20} color="black" />
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View className="px-4 py-3">
                        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                            <Ionicons name="search" size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-base text-black"
                                placeholder="Search country or code"
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    {/* List */}
                    <FlatList
                        data={filteredCountries}
                        keyExtractor={item => item.code}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        initialNumToRender={20}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
}
