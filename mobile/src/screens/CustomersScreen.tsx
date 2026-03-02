// Customers Screen - Customer List with Click-to-Call

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { customersApi, voipApi, Customer } from '../services/api';

export default function CustomersScreen() {
  const [search, setSearch] = useState('');

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.getAll(search || undefined),
  });

  const handleCall = async (customer: Customer) => {
    if (!customer.phone) return;

    try {
      const result = await voipApi.initiateCall({
        to_number: customer.phone,
        customer_id: customer.id,
      });

      if (result.success) {
        Alert.alert('Call Initiated', `Calling ${customer.name}...`);
      }
    } catch (error) {
      // Fallback to native dialer
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleSMS = async (customer: Customer) => {
    if (!customer.phone) return;
    Linking.openURL(`sms:${customer.phone}`);
  };

  const handleEmail = (customer: Customer) => {
    if (!customer.email) return;
    Linking.openURL(`mailto:${customer.email}`);
  };

  const renderCustomer = ({ item: customer }: { item: Customer }) => (
    <TouchableOpacity style={styles.customerCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </Text>
      </View>

      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{customer.name}</Text>
        {customer.address && (
          <Text style={styles.address} numberOfLines={1}>
            {customer.address}
          </Text>
        )}
        <View style={styles.contactRow}>
          {customer.phone && (
            <Text style={styles.phone}>{customer.phone}</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {customer.phone && (
          <>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCall(customer)}
            >
              <Ionicons name="call" size={22} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleSMS(customer)}
            >
              <Ionicons name="chatbubble" size={22} color="#10b981" />
            </TouchableOpacity>
          </>
        )}
        {customer.email && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleEmail(customer)}
          >
            <Ionicons name="mail" size={22} color="#8b5cf6" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomer}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {search ? 'No customers found' : 'No customers yet'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  address: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phone: {
    fontSize: 13,
    color: '#3b82f6',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 16,
  },
});
