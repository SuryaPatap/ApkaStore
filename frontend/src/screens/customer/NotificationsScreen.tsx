import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { notificationApi } from '../../api/endpoints';
import { Notification } from '../../types';

interface NotificationsScreenProps {
  onBackPress?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationApi.getNotifications();
      setNotifications(data || []);
    } catch (e) {
      console.log('Error fetching notifications:', e);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
    } catch (e) {
      // Local state fallback
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle="Live alerts for orders, khata & payments"
        showRoleToggle={false}
      />

      <View style={styles.topActions}>
        <Text style={styles.countText}>{notifications.length} alerts</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={styles.markReadText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary.main]}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, !item.is_read && styles.unreadCard]}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={item.is_read ? 'notifications-outline' : 'notifications'}
                  size={20}
                  color={item.is_read ? colors.text.secondary : colors.primary.main}
                />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, !item.is_read && styles.unreadTitle]}>
                    {item.title}
                  </Text>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>
                  {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No notifications yet"
              description="Important order updates, payment confirmations, and credit approvals will appear here."
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.main,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  unreadCard: {
    borderColor: colors.primary.light,
    backgroundColor: colors.primary.surface,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  unreadTitle: {
    fontWeight: '800',
    color: colors.primary.dark,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
  },
  message: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    color: colors.text.muted,
  },
});
