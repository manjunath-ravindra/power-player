import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Switch, Slider } from 'react-native-elements';
import { useSettings } from '../settings/SettingsContext';
import { useTheme } from '../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const SettingsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { theme, toggleTheme } = useTheme();
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

  const getSettingIcon = (setting: string) => {
    switch (setting) {
      case 'seekSensitivity': return 'fast-forward';
      case 'volumeSensitivity': return 'volume-up';
      case 'brightnessSensitivity': return 'brightness-6';
      case 'controlTimeout': return 'timer';
      default: return 'settings';
    }
  };

  const getSettingDescription = (setting: string) => {
    switch (setting) {
      case 'seekSensitivity': return 'Adjust how sensitive horizontal swipes are for seeking';
      case 'volumeSensitivity': return 'Adjust how sensitive vertical swipes are for volume control';
      case 'brightnessSensitivity': return 'Adjust how sensitive vertical swipes are for brightness control';
      case 'controlTimeout': return 'How long controls stay visible before auto-hiding';
      default: return '';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Customize your video player experience
          </Text>
        </View>

        {/* Theme Toggle */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="palette" size={24} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Dark Mode</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                Switch between light and dark themes
              </Text>
            </View>
            <Switch
              value={theme.mode === 'dark'}
              onValueChange={toggleTheme}
              color={theme.colors.primary}
            />
          </View>
        </View>

        {/* Gesture Controls */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="touch-app" size={24} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Gesture Controls</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Volume Gesture</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                Enable vertical swipe on right side for volume control
              </Text>
            </View>
            <Switch
              value={settings.volumeGesture}
              onValueChange={v => updateSetting('volumeGesture', v)}
              color={theme.colors.primary}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Brightness Gesture</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                Enable vertical swipe on left side for brightness control
              </Text>
            </View>
            <Switch
              value={settings.brightnessGesture}
              onValueChange={v => updateSetting('brightnessGesture', v)}
              color={theme.colors.primary}
            />
          </View>
        </View>

        {/* Sensitivity Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="tune" size={24} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Sensitivity</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => {
              setCurrentSetting('seekSensitivity');
              setTempValue(settings.seekSensitivity);
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon name={getSettingIcon('seekSensitivity')} size={20} color={theme.colors.primary} />
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Seek Sensitivity</Text>
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                {getSettingDescription('seekSensitivity')}
              </Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={[styles.valueText, { color: theme.colors.primary }]}>
                {settings.seekSensitivity.toFixed(2)}
              </Text>
              <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => {
              setCurrentSetting('volumeSensitivity');
              setTempValue(settings.volumeSensitivity);
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon name={getSettingIcon('volumeSensitivity')} size={20} color={theme.colors.primary} />
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Volume Sensitivity</Text>
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                {getSettingDescription('volumeSensitivity')}
              </Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={[styles.valueText, { color: theme.colors.primary }]}>
                {settings.volumeSensitivity.toFixed(2)}
              </Text>
              <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => {
              setCurrentSetting('brightnessSensitivity');
              setTempValue(settings.brightnessSensitivity);
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon name={getSettingIcon('brightnessSensitivity')} size={20} color={theme.colors.primary} />
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Brightness Sensitivity</Text>
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                {getSettingDescription('brightnessSensitivity')}
              </Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={[styles.valueText, { color: theme.colors.primary }]}>
                {settings.brightnessSensitivity.toFixed(2)}
              </Text>
              <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Player Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="play-circle-outline" size={24} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Player</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => {
              setCurrentSetting('controlTimeout');
              setTempValue(settings.controlTimeout);
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon name={getSettingIcon('controlTimeout')} size={20} color={theme.colors.primary} />
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Control Timeout</Text>
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                {getSettingDescription('controlTimeout')}
              </Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={[styles.valueText, { color: theme.colors.primary }]}>
                {settings.controlTimeout}s
              </Text>
              <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Enhanced Slider Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Icon name={getSettingIcon(currentSetting)} size={28} color={theme.colors.primary} />
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {getSettingTitle(currentSetting)}
              </Text>
            </View>
            
            <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
              {getSettingDescription(currentSetting)}
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
                maximumTrackTintColor={theme.colors.border}
                style={styles.modalSlider}
              />
              <View style={styles.valueDisplay}>
                <Text style={[styles.modalValue, { color: theme.colors.primary }]}>
                  {getFormattedValue(currentSetting, tempValue)}
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.colors.surface }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  updateSetting(currentSetting as keyof typeof settings, tempValue);
                  setModalVisible(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 40 
  },
  header: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 8 
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingLabel: { 
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 28,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: Dimensions.get('window').width * 0.85, 
    padding: 24, 
    borderRadius: 20, 
    elevation: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 8 
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginLeft: 12,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  sliderContainer: { 
    marginBottom: 32 
  },
  modalSlider: { 
    width: '100%', 
    height: 40 
  },
  valueDisplay: {
    alignItems: 'center',
    marginTop: 16,
  },
  modalValue: { 
    fontSize: 24, 
    fontWeight: 'bold',
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  modalButton: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 12, 
    marginHorizontal: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalButtonText: { 
    fontSize: 16, 
    fontWeight: '600',
  },
});

export default SettingsScreen; 