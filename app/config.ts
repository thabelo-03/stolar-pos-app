<<<<<<< HEAD
import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost?.split(':')[0];

const SERVER_IP = localhost || '192.168.3.64';
=======
// Replace this IP address with your computer's local IP
// This is the single source of truth for the API URL
const SERVER_IP = '192.168.3.64';
>>>>>>> 489bd713d862b5bad311828e0faf304d85111cb7
const PORT = '5000';

export const API_BASE_URL = `http://${SERVER_IP}:${PORT}/api`;