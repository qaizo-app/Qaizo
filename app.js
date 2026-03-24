// App.js
// ЗАМЕНИ ПОЛНОСТЬЮ существующий App.js этим файлом!
import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#080b14" />
      <AppNavigator />
    </NavigationContainer>
  );
}
