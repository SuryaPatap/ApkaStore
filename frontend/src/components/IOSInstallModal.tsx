import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { usePWA } from '../context/PWAContext';

export const IOSInstallModal: React.FC = () => {
  const { showIOSModal, setShowIOSModal, isIOS } = usePWA();

  if (!showIOSModal) {
    return null;
  }

  return (
    <Modal
      visible={showIOSModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowIOSModal(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.brandBadge}>
              <Ionicons name="storefront" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Install ApkaStore</Text>
              <Text style={styles.subtitle}>
                {isIOS ? 'Add to your iPhone Home Screen' : 'Install on your device'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowIOSModal(false)}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Instructions List */}
          <View style={styles.stepsContainer}>
            {isIOS ? (
              <>
                <View style={styles.stepItem}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Tap the Share button</Text>
                    <Text style={styles.stepDesc}>
                      Look for the <Ionicons name="share-outline" size={15} color={colors.primary.main} /> Share icon at the bottom of Safari.
                    </Text>
                  </View>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Select 'Add to Home Screen'</Text>
                    <Text style={styles.stepDesc}>
                      Scroll down the share sheet and tap <Ionicons name="add-circle-outline" size={15} color={colors.primary.main} /> <b>Add to Home Screen</b>.
                    </Text>
                  </View>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>3</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Tap 'Add' to finish</Text>
                    <Text style={styles.stepDesc}>
                      ApkaStore will appear directly on your home screen with quick launch & full offline capability!
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.stepItem}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Tap Browser Menu (⋮)</Text>
                    <Text style={styles.stepDesc}>Open your browser settings at the top right.</Text>
                  </View>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Tap 'Install App' or 'Add to Home Screen'</Text>
                    <Text style={styles.stepDesc}>Confirm installation to launch as a standalone application.</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => setShowIOSModal(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Got it, Thanks!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '100%',
    maxWidth: 440,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  stepsContainer: {
    gap: 14,
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  doneBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
