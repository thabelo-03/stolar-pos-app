// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // This automatically sends the user to the signup page on first launch
  return <Redirect href="/(auth)/signup" />;
}