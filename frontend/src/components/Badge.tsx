import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'primary', size = 'sm' }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: Colors.successSoft, text: Colors.primaryDark };
      case 'warning':
        return { bg: Colors.warningSoft, text: Colors.warningDark };
      case 'danger':
        return { bg: Colors.dangerSoft, text: Colors.dangerDark };
      case 'info':
        return { bg: Colors.infoSoft, text: Colors.info };
      case 'secondary':
        return { bg: Colors.surface, text: Colors.textSecondary };
      default:
        return { bg: Colors.primarySoft, text: Colors.primary };
    }
  };

  const { bg, text } = getColors();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        size === 'md' ? styles.badgeMd : styles.badgeSm,
      ]}
    >
      <Text style={[styles.text, { color: text }, size === 'md' && styles.textMd]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textMd: {
    fontSize: 13,
  },
});
