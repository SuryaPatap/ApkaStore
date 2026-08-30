import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PWAProvider } from './src/context/PWAContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { IOSInstallModal } from './src/components/IOSInstallModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <PWAProvider>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <AppNavigator />
            <IOSInstallModal />
          </CartProvider>
        </AuthProvider>
      </PWAProvider>
    </SafeAreaProvider>
  );
}
