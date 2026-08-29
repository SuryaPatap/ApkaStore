import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigateToRegister }) => {
  const { login, isLoading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setErrorMessage(null);
    try {
      await login(email.trim(), password.trim(), selectedRole);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Login failed. Please check your credentials.'
      );
    }
  };

  const handleSwitchTab = () => {
    setSelectedRole(selectedRole === 'CUSTOMER' ? 'SHOPKEEPER' : 'CUSTOMER');
    setErrorMessage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="storefront" size={38} color="#FFFFFF" />
          </View>
          <Text style={styles.brandName}>ApkaStore</Text>
          <Text style={styles.brandTagline}>
            Your Local Neighborhood Store & Digital Udhar Khata
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Role Tabs */}
          <View style={styles.roleTabs}>
            <TouchableOpacity
              style={[
                styles.roleTab,
                selectedRole === 'CUSTOMER' && styles.activeTab,
              ]}
              onPress={() => {
                setSelectedRole('CUSTOMER');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person"
                size={16}
                color={
                  selectedRole === 'CUSTOMER'
                    ? colors.primary.main
                    : colors.text.secondary
                }
              />
              <Text
                style={[
                  styles.roleTabText,
                  selectedRole === 'CUSTOMER' && styles.activeTabText,
                ]}
              >
                Customer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleTab,
                selectedRole === 'SHOPKEEPER' && styles.activeTab,
              ]}
              onPress={() => {
                setSelectedRole('SHOPKEEPER');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="briefcase"
                size={16}
                color={
                  selectedRole === 'SHOPKEEPER'
                    ? colors.primary.main
                    : colors.text.secondary
                }
              />
              <Text
                style={[
                  styles.roleTabText,
                  selectedRole === 'SHOPKEEPER' && styles.activeTabText,
                ]}
              >
                Shopkeeper
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <Text style={styles.cardTitle}>
            Sign In as {selectedRole === 'CUSTOMER' ? 'Customer' : 'Shopkeeper'}
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger.dark} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {errorMessage.includes('Please sign in under the') && (
                  <TouchableOpacity
                    style={styles.switchTabBtn}
                    onPress={handleSwitchTab}
                  >
                    <Text style={styles.switchTabBtnText}>
                      Switch to {selectedRole === 'CUSTOMER' ? 'Shopkeeper' : 'Customer'} Tab →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={colors.text.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={colors.text.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInButtonText}>
                Sign In to ApkaStore
              </Text>
            )}
          </TouchableOpacity>

          {/* Footer Register Link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to ApkaStore? </Text>
            <TouchableOpacity onPress={onNavigateToRegister}>
              <Text style={styles.registerLink}>Register Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.subtle,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  activeTabText: {
    fontWeight: '800',
    color: colors.primary.main,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.danger.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.danger.main,
  },
  errorText: {
    color: colors.danger.dark,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  switchTabBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  switchTabBtnText: {
    color: colors.primary.main,
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
  },
  signInButton: {
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  registerLink: {
    color: colors.primary.main,
    fontSize: 13,
    fontWeight: '800',
  },
});
