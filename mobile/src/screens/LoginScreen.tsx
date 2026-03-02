// Login Screen

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (role: string) => {
    setIsLoading(true);
    try {
      const demoCredentials: Record<string, { email: string; password: string }> = {
        admin: { email: 'admin@breezeflow.com', password: 'admin' },
        technician: { email: 'tech@breezeflow.com', password: 'tech123' },
      };
      const creds = demoCredentials[role];
      await login(creds.email, creds.password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>BreezeFlow</Text>
          <Text style={styles.tagline}>HVAC Field Service</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Demo Accounts */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Quick Demo Access</Text>
          <View style={styles.demoButtons}>
            <TouchableOpacity
              style={[styles.button, styles.demoButton]}
              onPress={() => handleDemoLogin('admin')}
              disabled={isLoading}
            >
              <Text style={styles.demoButtonText}>Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.demoButton]}
              onPress={() => handleDemoLogin('technician')}
              disabled={isLoading}
            >
              <Text style={styles.demoButtonText}>Technician</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  demoSection: {
    marginTop: 48,
  },
  demoTitle: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 16,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  demoButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  demoButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
});
