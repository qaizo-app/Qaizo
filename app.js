// App.js
// ЗАМЕНИ полностью — добавлен GestureHandlerRootView для свайпов
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}