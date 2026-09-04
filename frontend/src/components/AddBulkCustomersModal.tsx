import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { customerApi } from '../api/endpoints';

interface AddBulkCustomersModalProps {
  visible: boolean;
  onClose: () => void;
  onCustomersAdded: () => void;
}

interface CustomerRow {
  name: string;
  phone: string;
  notes?: string;
}

const createInitialRows = (count: number = 10): CustomerRow[] => {
  return Array.from({ length: count }, () => ({
    name: '',
    phone: '',
    notes: '',
  }));
};

export const AddBulkCustomersModal: React.FC<AddBulkCustomersModalProps> = ({
  visible,
  onClose,
  onCustomersAdded,
}) => {
  const [activeTab, setActiveTab] = useState<'TABLE' | 'PASTE'>('TABLE');
  const [rows, setRows] = useState<CustomerRow[]>(createInitialRows(10));
  const [pasteText, setPasteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateRow = (index: number, field: keyof CustomerRow, value: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const handleAddMoreRows = (count: number = 5) => {
    setRows((prev) => [...prev, ...createInitialRows(count)]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParsePasteText = () => {
    if (!pasteText.trim()) {
      Alert.alert('Empty Text', 'Please paste customer names and phone numbers.');
      return;
    }

    const lines = pasteText.split('\n').filter((l) => l.trim().length > 0);
    const parsedRows: CustomerRow[] = [];

    for (const line of lines) {
      // Look for 10-digit phone number
      const phoneMatch = line.match(/(?:\+91|91)?[6-9]\d{9}/);
      const phone = phoneMatch ? phoneMatch[0].replace(/^(?:\+91|91)/, '') : '';
      
      // Name is the rest of the text
      let name = line.replace(/(?:\+91|91)?[6-9]\d{9}/, '').replace(/[-–:,|()]/g, ' ').trim();
      if (!name && phone) {
        name = `Customer ${phone.slice(-4)}`;
      }

      if (phone.length === 10) {
        parsedRows.push({
          name: name || 'Customer',
          phone: phone,
          notes: '',
        });
      }
    }

    if (parsedRows.length === 0) {
      Alert.alert('No Valid Numbers Found', 'Please ensure each line contains a valid 10-digit Indian phone number.');
      return;
    }

    setRows(parsedRows);
    setActiveTab('TABLE');
    Alert.alert('Contacts Parsed 🎉', `Successfully extracted ${parsedRows.length} customer contacts!`);
  };

  const filledRows = rows.filter((r) => r.phone.trim().length >= 10 && r.name.trim().length > 0);

  const handleSubmit = async () => {
    if (filledRows.length === 0) {
      Alert.alert(
        'No Customers Entered',
        'Please enter at least one customer with a Name and valid 10-digit Phone Number.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = filledRows.map((r) => {
        let cleanPhone = r.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
          cleanPhone = cleanPhone.slice(-10);
        }
        return {
          name: r.name.trim(),
          phone: cleanPhone,
          notes: r.notes?.trim() || undefined,
        };
      });

      const res = await customerApi.addBulkCustomers(payload);
      Alert.alert(
        'Customers Added 🎉',
        `Successfully added and connected ${filledRows.length} customers to your store directory!`
      );
      onCustomersAdded();
      setRows(createInitialRows(10));
      setPasteText('');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message || 'Failed to add customers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="people" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add 10+ Customers at Once</Text>
                <Text style={styles.modalSub}>Bulk import customer phone numbers to your store directory</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Switcher */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'TABLE' && styles.tabBtnActive]}
              onPress={() => setActiveTab('TABLE')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="grid-outline"
                size={15}
                color={activeTab === 'TABLE' ? colors.primary.main : colors.text.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'TABLE' && styles.tabBtnTextActive]}>
                Table Grid ({rows.length} rows)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'PASTE' && styles.tabBtnActive]}
              onPress={() => setActiveTab('PASTE')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="clipboard-outline"
                size={15}
                color={activeTab === 'PASTE' ? colors.primary.main : colors.text.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'PASTE' && styles.tabBtnTextActive]}>
                Quick Paste / Import List
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {activeTab === 'PASTE' ? (
              <View style={styles.pasteCard}>
                <Text style={styles.pasteTitle}>📋 Paste Customer Names & Phone Numbers</Text>
                <Text style={styles.pasteSub}>
                  Paste any list from WhatsApp or Excel (e.g. "Rahul Sharma - 9876543210"). We will automatically extract names and phone numbers into the table!
                </Text>

                <TextInput
                  style={styles.pasteInput}
                  multiline
                  numberOfLines={10}
                  placeholder={`Rahul Sharma - 9876543210
Pooja Verma - 9812345678
Sunil Kirana, 9898989898
9800011122 (Vikram Singh)`}
                  placeholderTextColor={colors.text.muted}
                  value={pasteText}
                  onChangeText={setPasteText}
                />

                <TouchableOpacity style={styles.parseBtn} onPress={handleParsePasteText} activeOpacity={0.85}>
                  <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.parseBtnText}>Auto-Extract Contacts into Table</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.th, { width: 34 }]}>#</Text>
                  <Text style={[styles.th, { flex: 1.4 }]}>Customer Name *</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>10-Digit Mobile *</Text>
                  <Text style={[styles.th, { flex: 1 }]}>Notes / Area</Text>
                  <Text style={[styles.th, { width: 28 }]}></Text>
                </View>

                {rows.map((row, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.rowIndexText}>#{idx + 1}</Text>

                    <TextInput
                      style={[styles.cellInput, { flex: 1.4, marginRight: 6 }]}
                      placeholder="e.g. Ramesh Kumar"
                      placeholderTextColor={colors.text.muted}
                      value={row.name}
                      onChangeText={(v) => handleUpdateRow(idx, 'name', v)}
                    />

                    <TextInput
                      style={[styles.cellInput, { flex: 1.2, marginRight: 6 }]}
                      placeholder="9876543210"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="phone-pad"
                      maxLength={13}
                      value={row.phone}
                      onChangeText={(v) => handleUpdateRow(idx, 'phone', v)}
                    />

                    <TextInput
                      style={[styles.cellInput, { flex: 1, marginRight: 6 }]}
                      placeholder="Sector 12"
                      placeholderTextColor={colors.text.muted}
                      value={row.notes}
                      onChangeText={(v) => handleUpdateRow(idx, 'notes', v)}
                    />

                    <TouchableOpacity style={styles.removeRowBtn} onPress={() => handleRemoveRow(idx)}>
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addRowsBar}>
                  <TouchableOpacity
                    style={styles.addRowsBtn}
                    onPress={() => handleAddMoreRows(5)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={16} color={colors.primary.main} />
                    <Text style={styles.addRowsBtnText}>+ Add 5 More Rows</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.addRowsBtn}
                    onPress={() => handleAddMoreRows(10)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={16} color={colors.primary.main} />
                    <Text style={styles.addRowsBtnText}>+ Add 10 Rows</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <View style={styles.footerLeft}>
              <Text style={styles.filledCountText}>
                Ready to Add: <Text style={{ fontWeight: '800', color: colors.primary.main }}>{filledRows.length}</Text> customers
              </Text>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, (filledRows.length === 0 || isSubmitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={filledRows.length === 0 || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    Save All Customers ({filledRows.length})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: { boxShadow: '0 20px 30px -5px rgba(0,0,0,0.25)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: colors.primary.main,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  tabBtnTextActive: {
    color: colors.primary.main,
  },
  modalBody: {
    flex: 1,
    padding: 14,
  },
  pasteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pasteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  pasteSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 17,
  },
  pasteInput: {
    height: 180,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: colors.text.primary,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  parseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  parseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginBottom: 6,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowIndexText: {
    width: 34,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    paddingLeft: 4,
  },
  cellInput: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: colors.text.primary,
  },
  removeRowBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  addRowsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary.main,
    backgroundColor: '#EEF2FF',
    gap: 6,
  },
  addRowsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.main,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  footerLeft: {
    flex: 1,
  },
  filledCountText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
