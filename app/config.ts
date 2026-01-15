import Constants from 'expo-constants';
import { Platform } from 'react-native';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost?.split(':')[0];

let SERVER_IP = localhost || '192.168.3.64';

if (Platform.OS === 'web') {
  SERVER_IP = 'localhost';
}

const PORT = '5000';

export const API_BASE_URL = `http://${SERVER_IP}:${PORT}/api`;