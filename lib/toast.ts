import Toast from 'react-native-toast-message';
export const toast = {
  success: (msg: string, sub?: string) => Toast.show({ type: 'success', text1: msg, text2: sub, position: 'top', visibilityTime: 2500, topOffset: 60 }),
  error: (msg: string, sub?: string) => Toast.show({ type: 'error', text1: msg, text2: sub, position: 'top', visibilityTime: 3000, topOffset: 60 }),
  info: (msg: string, sub?: string) => Toast.show({ type: 'info', text1: msg, text2: sub, position: 'top', visibilityTime: 2000, topOffset: 60 }),
};
