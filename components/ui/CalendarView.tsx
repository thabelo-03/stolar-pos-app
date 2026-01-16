import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '../themed-view';
import { ThemedText } from '../themed-text';

interface CalendarViewProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ visible, onClose, onSelectDate }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <ThemedView style={styles.modalView}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={24} color="#888" />
          </TouchableOpacity>
          <ThemedText style={styles.modalTitle}>Select a Date</ThemedText>
          <Calendar
            onDayPress={(day) => {
              onSelectDate(day.dateString);
            }}
            monthFormat={'MMMM yyyy'}
            hideExtraDays={true}
            firstDay={1}
          />
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 15
  }
});

export default CalendarView;
