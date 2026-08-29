import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { notificationApi } from '../api/endpoints';
import { Notification } from '../types';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOrder?: (orderId: number) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onSelectOrder,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await notificationApi.getNotifications();
      setNotifications(data || []);
    } catch (e) {
      if (!silent) setNotifications([]);
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications(false);
    }
  }, [visible]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      // silent
    }
  };

  const handlePressItem = async (item: Notification) => {
    try {
      if (!item.is_read) {
        await notificationApi.markAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
      }
      if (item.order_id && onSelectOrder) {
        onClose();
        onSelectOrder(item.order_id);
      }
    } catch (e) {
      // silent
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>🔔 Notifications</Text>
            <Text style={styles.subtitle}>Live alerts & order updates</Text>
          </View>
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn} activeOpacity={0.8}>
            <Text style={styles.markReadText}>Mark all</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={styles.loadingText}>Fetching updates...</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchNotifications(false);
                }}
                colors={[colors.primary.main]}
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.itemCard, !item.is_read && styles.unreadCard]}
                onPress={() => handlePressItem(item)}
                activeOpacity={0.85}
              >
                <View style={[styles.iconBox, !item.is_read ? styles.unreadIconBox : styles.readIconBox]}>
                  <Ionicons
                    name={
                      item.type === 'NEW_ORDER'
                        ? 'bag-add'
                        : item.type === 'PARCHI_MESSAGE'
                        ? 'chatbubble-ellipses'
                        : item.type === 'PRICE_UPDATE'
                        ? 'pricetag'
                        : 'notifications'
                    }
                    size={20}
                    color={!item.is_read ? colors.primary.main : colors.text.secondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemTitle, !item.is_read && styles.unreadText]}>
                      {item.title}
                    </Text>
                    {!item.is_read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                  <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={54} color={colors.text.muted} />
                <Text style={styles.emptyTitle}>No Notifications Yet</Text>
                <Text style={styles.emptySub}>
                  You'll be alerted when orders are placed, updated, or messages are exchanged.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  markReadBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.primary.surface,
    borderRadius: 8,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.main,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  unreadCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadIconBox: {
    backgroundColor: '#E0F2FE',
  },
  readIconBox: {
    backgroundColor: '#F1F5F9',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  unreadText: {
    fontWeight: '800',
    color: '#0369A1',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
    marginLeft: 6,
  },
  itemMessage: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 6,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
