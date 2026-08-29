import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../api/endpoints';
import { NotificationModal } from './NotificationModal';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showRoleToggle?: boolean;
  showNotifications?: boolean;
  onNotificationPress?: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showRoleToggle = true,
  showNotifications = true,
  onNotificationPress,
  unreadCount: explicitUnreadCount,
}) => {
  const { role, user } = useAuth();
  const [internalUnread, setInternalUnread] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);

  useEffect(() => {
    if (explicitUnreadCount !== undefined) return;
    const fetchUnread = async () => {
      try {
        const res = await notificationApi.getUnreadCount();
        setInternalUnread(res.unread_count || 0);
      } catch (e) {
        // silent
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    return () => clearInterval(interval);
  }, [explicitUnreadCount]);

  const activeUnread = explicitUnreadCount !== undefined ? explicitUnreadCount : internalUnread;

  const handlePressBell = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      setShowModal(true);
      setInternalUnread(0);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : (
            user && <Text style={styles.greeting}>Hi, {user.name} 👋</Text>
          )}
        </View>

        <View style={styles.actions}>
          {showRoleToggle && (
            <View
              style={[
                styles.roleBadge,
                role === 'SHOPKEEPER' ? styles.shopkeeperBadge : styles.customerBadge,
              ]}
            >
              <Ionicons
                name={role === 'SHOPKEEPER' ? 'storefront-outline' : 'person-outline'}
                size={13}
                color={role === 'SHOPKEEPER' ? colors.gold.dark : colors.primary.dark}
              />
              <Text
                style={[
                  styles.roleText,
                  { color: role === 'SHOPKEEPER' ? colors.gold.dark : colors.primary.dark },
                ]}
              >
                {role === 'SHOPKEEPER' ? 'Shopkeeper' : 'Customer'}
              </Text>
            </View>
          )}

          {showNotifications && (
            <TouchableOpacity style={styles.iconButton} onPress={handlePressBell} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
              {activeUnread > 0 && (
                <View style={styles.notificationDot}>
                  <Text style={styles.dotText}>{activeUnread > 9 ? '9+' : activeUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <NotificationModal visible={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  greeting: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  customerBadge: {
    backgroundColor: colors.primary.surface,
    borderColor: colors.primary.light,
  },
  shopkeeperBadge: {
    backgroundColor: colors.gold.surface,
    borderColor: colors.gold.light,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger.main,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dotText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
