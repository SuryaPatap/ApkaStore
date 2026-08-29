import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { parchiApi, ParchiMessage, ParchiThread, ParchiDetail } from '../../api/endpoints';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// ─── Parchi Chat Screen (Shopkeeper View) ─────────────────────────────────────

interface ChatScreenProps {
  parchi: ParchiThread;
  onBack: () => void;
}

const ParchiChatScreen: React.FC<ChatScreenProps> = ({ parchi, onBack }) => {
  const [messages, setMessages] = useState<ParchiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [respondingMsgId, setRespondingMsgId] = useState<number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const lastMsgId = useRef<number>(0);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const detail = await parchiApi.getShopkeeperParchiDetail(parchi.id);
      setMessages(detail.messages || []);
      if (detail.messages && detail.messages.length > 0) {
        lastMsgId.current = detail.messages[detail.messages.length - 1].id;
      }
    } catch {
      Alert.alert('Error', 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [parchi.id]);

  // Polling every 3s
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const newMsgs = await parchiApi.getMessages(parchi.id, lastMsgId.current);
        if (newMsgs && newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const fresh = newMsgs.filter(m => !existingIds.has(m.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
          lastMsgId.current = newMsgs[newMsgs.length - 1].id;
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      } catch {
        // silent
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [parchi.id]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    try {
      setSending(true);
      const msg = await parchiApi.sendMessage(parchi.id, inputText.trim());
      setMessages(prev => [...prev, msg]);
      lastMsgId.current = msg.id;
      setInputText('');
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (msgId: number, action: 'CONFIRM' | 'DECLINE') => {
    try {
      setRespondingMsgId(msgId);
      const note = action === 'CONFIRM'
        ? '✅ Order confirmed by store! Packing in progress.'
        : '❌ Sorry, store cannot fulfill this order at the moment.';
      await parchiApi.respondToOrder(msgId, action, note);
      await loadMessages();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to respond.');
    } finally {
      setRespondingMsgId(null);
    }
  };

  const handleCallCustomer = () => {
    if (parchi.customer_phone) {
      Linking.openURL(`tel:${parchi.customer_phone}`);
    } else {
      Alert.alert('Phone', 'Customer phone number not available.');
    }
  };

  const renderMessage = ({ item }: { item: ParchiMessage }) => {
    const isMine = item.sender_role === 'SHOPKEEPER';
    const isSystem = item.sender_role === 'SYSTEM';
    const isParchiList = item.message_type === 'PARCHI_LIST';
    const isOrderReq = item.message_type === 'ORDER_REQUEST';
    const isConfirm = item.message_type === 'ORDER_CONFIRMED';
    const isDecline = item.message_type === 'ORDER_DECLINED';

    if (isSystem) {
      return (
        <View style={cs.systemRow}>
          <Ionicons name="information-circle" size={14} color={colors.primary.main} />
          <Text style={cs.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[cs.row, isMine ? cs.rowRight : cs.rowLeft]}>
        <View
          style={[
            cs.bubble,
            isMine ? cs.bubbleMine : cs.bubbleTheirs,
            isParchiList && cs.bubbleParchiList,
            isOrderReq && cs.bubbleOrder,
            isConfirm && cs.bubbleConfirm,
            isDecline && cs.bubbleDecline,
          ]}
        >
          {isParchiList && (
            <View style={cs.parchiBadge}>
              <Ionicons name="clipboard" size={12} color={colors.gold.dark} />
              <Text style={cs.parchiBadgeText}>CUSTOMER DIGITAL PARCHI</Text>
            </View>
          )}
          {isOrderReq && (
            <View style={cs.orderBadge}>
              <Ionicons name="cart" size={12} color={colors.primary.dark} />
              <Text style={cs.orderBadgeText}>CATALOG ORDER REQUEST</Text>
            </View>
          )}
          {isConfirm && (
            <View style={[cs.orderBadge, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[cs.orderBadgeText, { color: '#065F46' }]}>✅ CONFIRMED</Text>
            </View>
          )}
          {isDecline && (
            <View style={[cs.orderBadge, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[cs.orderBadgeText, { color: '#991B1B' }]}>❌ DECLINED</Text>
            </View>
          )}

          <Text style={[cs.msgText, isMine && cs.msgTextMine]}>{item.content}</Text>

          {item.order_id && (
            <Text style={[cs.orderRef, isMine && { color: '#CBD5E1' }]}>
              Order ID #{item.order_id}
            </Text>
          )}

          <Text style={[cs.time, isMine && cs.timeMine]}>{formatTime(item.created_at)}</Text>

          {/* Confirm / Decline buttons for customer catalog order requests */}
          {isOrderReq && !isMine && (
            <View style={cs.actionRow}>
              <TouchableOpacity
                style={cs.confirmBtn}
                onPress={() => handleRespond(item.id, 'CONFIRM')}
                disabled={respondingMsgId === item.id}
                activeOpacity={0.8}
              >
                {respondingMsgId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={cs.confirmBtnText}>✅ Confirm & Pack</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={cs.declineBtn}
                onPress={() => handleRespond(item.id, 'DECLINE')}
                disabled={respondingMsgId === item.id}
                activeOpacity={0.8}
              >
                <Text style={cs.declineBtnText}>❌ Decline</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick acknowledge for Parchi grocery list */}
          {isParchiList && !isMine && (
            <TouchableOpacity
              style={cs.ackBtn}
              onPress={() => handleSendDirectReply(item.id, 'Parchi Received! Packing your grocery items now.')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={14} color="#065F46" />
              <Text style={cs.ackBtnText}>Send "Packing Now" Update</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const handleSendDirectReply = async (_msgId: number, text: string) => {
    try {
      const msg = await parchiApi.sendMessage(parchi.id, text);
      setMessages(prev => [...prev, msg]);
      lastMsgId.current = msg.id;
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch {
      Alert.alert('Error', 'Failed to reply.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={cs.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header with Customer Details */}
      <View style={cs.header}>
        <TouchableOpacity onPress={onBack} style={cs.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={cs.avatar}>
          <Ionicons name="person" size={18} color="#fff" />
        </View>
        <View style={cs.headerInfo}>
          <Text style={cs.customerName}>{parchi.customer_name || 'Customer'}</Text>
          <Text style={cs.subHeader} numberOfLines={1}>
            {parchi.customer_phone ? `📞 ${parchi.customer_phone}` : 'Active Parchi'}
            {parchi.customer_address ? ` • 📍 ${parchi.customer_address}` : ''}
          </Text>
        </View>

        {parchi.customer_phone && (
          <TouchableOpacity style={cs.callBtn} onPress={handleCallCustomer}>
            <Ionicons name="call" size={16} color={colors.primary.main} />
          </TouchableOpacity>
        )}
      </View>

      {/* Customer Address Banner */}
      {parchi.customer_address && (
        <View style={cs.addressBanner}>
          <Ionicons name="location" size={14} color={colors.primary.dark} />
          <Text style={cs.addressBannerText} numberOfLines={2}>
            Delivery Address: {parchi.customer_address}
          </Text>
        </View>
      )}

      {/* Messages List */}
      {loading ? (
        <View style={cs.centered}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={{ marginTop: 10, color: colors.text.secondary }}>Loading conversation...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={cs.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={cs.centered}>
              <Text style={{ color: colors.text.secondary }}>No messages yet.</Text>
            </View>
          }
        />
      )}

      {/* Reply Input */}
      <View style={cs.inputRow}>
        <TextInput
          style={cs.input}
          placeholder="Reply to customer..."
          placeholderTextColor={colors.text.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[cs.sendBtn, (!inputText.trim() || sending) && cs.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Main Shopkeeper Parchi Inbox Screen ───────────────────────────────────────

export const ParchiInboxScreen: React.FC = () => {
  const [threads, setThreads] = useState<ParchiThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedParchi, setSelectedParchi] = useState<ParchiThread | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      setError(null);
      const data = await parchiApi.getShopkeeperParchis();
      setThreads(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load Parchis.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
    const poll = setInterval(loadThreads, 4000);
    return () => clearInterval(poll);
  }, [loadThreads]);

  const onRefresh = () => {
    setRefreshing(true);
    loadThreads();
  };

  if (selectedParchi) {
    return (
      <ParchiChatScreen
        parchi={selectedParchi}
        onBack={() => {
          setSelectedParchi(null);
          loadThreads();
        }}
      />
    );
  }

  return (
    <View style={is.container}>
      {/* Header */}
      <View style={is.header}>
        <View style={is.headerTitleRow}>
          <Ionicons name="chatbubbles" size={22} color={colors.primary.main} />
          <Text style={is.headerTitle}>Parchi & Chat Inbox</Text>
        </View>
        <Text style={is.headerSub}>
          Live customer grocery lists, conversation orders & dispatch requests
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={is.centered}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={{ marginTop: 10, color: colors.text.secondary }}>Loading customer Parchis...</Text>
        </View>
      ) : error ? (
        <View style={is.centered}>
          <Text style={is.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadThreads} style={is.retryBtn}>
            <Text style={is.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={is.threadRow}
              onPress={() => setSelectedParchi(item)}
              activeOpacity={0.8}
            >
              <View style={is.avatar}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <View style={is.threadInfo}>
                <View style={is.threadTopRow}>
                  <Text style={is.customerName}>{item.customer_name || 'Customer'}</Text>
                  {item.last_message_at && (
                    <Text style={is.lastTime}>{formatTime(item.last_message_at)}</Text>
                  )}
                </View>

                {item.customer_phone && (
                  <Text style={is.customerPhone}>📞 {item.customer_phone}</Text>
                )}

                {item.customer_address && (
                  <Text style={is.customerAddr} numberOfLines={1}>
                    📍 {item.customer_address}
                  </Text>
                )}

                <Text style={is.preview} numberOfLines={2}>
                  {item.last_message_preview || 'Tap to view conversation'}
                </Text>

                <View style={is.statsRow}>
                  <View style={is.statBadge}>
                    <Text style={is.statText}>📦 {item.order_count} Parchi Orders</Text>
                  </View>
                  <View style={is.statBadge}>
                    <Text style={is.statText}>💬 {item.message_count} messages</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={is.centered}>
              <Ionicons name="chatbubbles-outline" size={60} color={colors.primary.light} />
              <Text style={is.emptyTitle}>No Customer Parchis Yet</Text>
              <Text style={is.emptySubtitle}>
                When customers in your 2km neighborhood send a grocery Parchi list or order via chat, it will show up here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  backBtn: { padding: 4 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '800', color: colors.text.primary },
  subHeader: { fontSize: 11, color: colors.text.secondary, marginTop: 1 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  addressBannerText: { fontSize: 11, color: colors.primary.dark, fontWeight: '600', flex: 1 },
  messageList: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 16 },
  row: { marginVertical: 4, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleMine: { backgroundColor: colors.primary.main, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  bubbleParchiList: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: colors.gold.main,
    borderBottomLeftRadius: 4,
  },
  bubbleOrder: { borderWidth: 1.5, borderColor: colors.primary.light },
  bubbleConfirm: { borderWidth: 1.5, borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  bubbleDecline: { borderWidth: 1.5, borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  parchiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  parchiBadgeText: { fontSize: 10, fontWeight: '800', color: colors.gold.dark },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  orderBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary.dark },
  msgText: { fontSize: 14, color: colors.text.primary, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  orderRef: { fontSize: 11, color: colors.text.secondary, fontStyle: 'italic', marginTop: 2 },
  time: { fontSize: 10, color: '#94A3B8', alignSelf: 'flex-end', marginTop: 2 },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  systemText: { fontSize: 12, color: colors.text.secondary, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  declineBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  declineBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 8,
  },
  ackBtnText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text.primary,
    maxHeight: 90,
  },
  sendBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: 20,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});

const is = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 19, fontWeight: '900', color: colors.text.primary },
  headerSub: { fontSize: 12, color: colors.text.secondary, marginTop: 3 },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadInfo: { flex: 1 },
  threadTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerName: { fontSize: 16, fontWeight: '800', color: colors.text.primary },
  lastTime: { fontSize: 11, color: colors.text.secondary },
  customerPhone: { fontSize: 12, color: colors.primary.main, fontWeight: '600', marginTop: 1 },
  customerAddr: { fontSize: 11, color: colors.text.secondary, marginTop: 1 },
  preview: { fontSize: 13, color: colors.text.secondary, marginTop: 4, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statText: { fontSize: 10, color: colors.primary.dark, fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text.primary, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: '800' },
});
