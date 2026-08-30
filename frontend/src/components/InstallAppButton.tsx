import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { usePWA } from '../context/PWAContext';

interface InstallAppButtonProps {
  variant?: 'header' | 'banner' | 'card' | 'badge';
  style?: any;
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({ variant = 'header', style }) => {
  const { isInstalled, promptInstall } = usePWA();

  // If already installed as standalone PWA, hide cleanly
  if (isInstalled || Platform.OS !== 'web') {
    return null;
  }

  if (variant === 'banner') {
    return (
      <View style={[styles.bannerContainer, style]}>
        <View style={styles.bannerLeft}>
          <View style={styles.bannerIconBox}>
            <Ionicons name="phone-portrait" size={18} color={colors.primary.main} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.bannerTitle}>Get ApkaStore App</Text>
            <Text style={styles.bannerSubtitle}>Faster orders, offline notes & live notifications</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bannerBtn}
          onPress={promptInstall}
          activeOpacity={0.85}
        >
          <Ionicons name="download" size={13} color="#FFFFFF" />
          <Text style={styles.bannerBtnText}>Install</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (variant === 'badge') {
    return (
      <TouchableOpacity
        style={[styles.badgeBtn, style]}
        onPress={promptInstall}
        activeOpacity={0.85}
      >
        <Ionicons name="download-outline" size={13} color="#059669" />
        <Text style={styles.badgeBtnText}>📲 Install App</Text>
      </TouchableOpacity>
    );
  }

  // Default 'header' compact button
  return (
    <TouchableOpacity
      style={[styles.headerBtn, style]}
      onPress={promptInstall}
      activeOpacity={0.8}
    >
      <Ionicons name="download" size={12} color="#FFFFFF" />
      <Text style={styles.headerBtnText}>📲 Install ApkaStore</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary.main,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  headerBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  badgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgeBtnText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  bannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.main,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  bannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
