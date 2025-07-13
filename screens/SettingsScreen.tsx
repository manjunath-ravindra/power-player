import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Switch, Slider } from 'react-native-elements';
import { useSettings } from '../settings/SettingsContext';
import { useTheme } from '../theme/ThemeContext';

const SettingsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSetting, setCurrentSetting] = useState<string>('');
  const [tempValue, setTempValue] = useState<number>(0);

  const getSettingTitle = (setting: string) => {
    switch (setting) {
      case 'seekSensitivity': return 'Seek Sensitivity';
      case 'volumeSensitivity': return 'Volume Sensitivity';
      case 'brightnessSensitivity': return 'Brightness Sensitivity';
      case 'controlTimeout': return 'Control Timeout';
      default: return 'Setting';
    }
  };

  const getMinValue = (setting: string) => {
    switch (setting) {
      case 'seekSensitivity': return 0.05;
      case 'volumeSensitivity': return 0.01;
      case 'brightnessSensitivity': return 0.01;
      case 'controlTimeout': return 1;
      default: return 0;
    }
  };

  const getMaxValue = (setting: string) => {
    switch (setting) {
      case 'seekSensitivity': return 0.5;
      case 'volumeSensitivity': return 0.2;
      case 'brightnessSensitivity': return 0.2;
      case 'controlTimeout': return 10;
      default: return 1;
    }
  };

  const getStepValue = (setting: string) => {
    switch (setting) {
      case 'seekSensitivity': return 0.01;
      case 'volumeSensitivity': return 0.01;
      case 'brightnessSensitivity': return 0.01;
      case 'controlTimeout': return 0.5;
      default: return 0.01;
    }
  };

  const getFormattedValue = (setting: string, value: number) => {
    switch (setting) {
      case 'seekSensitivity': return value.toFixed(2);
      case 'volumeSensitivity': return value.toFixed(2);
      case 'brightnessSensitivity': return value.toFixed(2);
      case 'controlTimeout': return `${value}s`;
      default: return value.toString();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Enable Volume Gesture</Text>
        <Switch
          value={settings.volumeGesture}
          onValueChange={v => updateSetting('volumeGesture', v)}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Enable Brightness Gesture</Text>
        <Switch
          value={settings.brightnessGesture}
          onValueChange={v => updateSetting('brightnessGesture', v)}
          color={theme.colors.primary}
        />
      </View>
      <TouchableOpacity 
        style={styles.settingRow}
        onPress={() => {
          setCurrentSetting('seekSensitivity');
          setTempValue(settings.seekSensitivity);
          setModalVisible(true);
        }}
      >
        <Text style={[styles.label, { color: theme.colors.text }]}>Seek Sensitivity</Text>
        <Text style={{ color: theme.colors.text, width: 40, textAlign: 'right' }}>{settings.seekSensitivity.toFixed(2)}</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.settingRow}
        onPress={() => {
          setCurrentSetting('volumeSensitivity');
          setTempValue(settings.volumeSensitivity);
          setModalVisible(true);
        }}
      >
        <Text style={[styles.label, { color: theme.colors.text }]}>Volume Sensitivity</Text>
        <Text style={{ color: theme.colors.text, width: 40, textAlign: 'right' }}>{settings.volumeSensitivity.toFixed(2)}</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.settingRow}
        onPress={() => {
          setCurrentSetting('brightnessSensitivity');
          setTempValue(settings.brightnessSensitivity);
          setModalVisible(true);
        }}
      >
        <Text style={[styles.label, { color: theme.colors.text }]}>Brightness Sensitivity</Text>
        <Text style={{ color: theme.colors.text, width: 40, textAlign: 'right' }}>{settings.brightnessSensitivity.toFixed(2)}</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.settingRow}
        onPress={() => {
          setCurrentSetting('controlTimeout');
          setTempValue(settings.controlTimeout);
          setModalVisible(true);
        }}
      >
        <Text style={[styles.label, { color: theme.colors.text }]}>Control Timeout (seconds)</Text>
        <Text style={{ color: theme.colors.text, width: 40, textAlign: 'right' }}>{settings.controlTimeout}s</Text>
              </TouchableOpacity>
      </ScrollView>

      {/* Slider Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {getSettingTitle(currentSetting)}
            </Text>
            
            <View style={styles.sliderContainer}>
              <Slider
                value={tempValue}
                onValueChange={setTempValue}
                minimumValue={getMinValue(currentSetting)}
                maximumValue={getMaxValue(currentSetting)}
                step={getStepValue(currentSetting)}
                thumbTintColor={theme.colors.primary}
                minimumTrackTintColor={theme.colors.primary}
                style={styles.modalSlider}
              />
              <Text style={[styles.modalValue, { color: theme.colors.text }]}>
                {getFormattedValue(currentSetting, tempValue)}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.colors.background }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  updateSetting(currentSetting as keyof typeof settings, tempValue);
                  setModalVisible(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: Dimensions.get('window').width * 0.8, padding: 24, borderRadius: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sliderContainer: { marginBottom: 24 },
  modalSlider: { width: '100%', height: 40 },
  modalValue: { fontSize: 16, textAlign: 'center', marginTop: 8 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, marginHorizontal: 8 },
  modalButtonText: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
});

export default SettingsScreen; 