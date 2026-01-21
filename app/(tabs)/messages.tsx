import { StyleSheet, Text, View } from 'react-native';

export default function MessagesScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Messages</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
});
