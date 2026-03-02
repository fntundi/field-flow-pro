// Jobs Screen - List and Manage Jobs

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { jobsApi, voipApi, Job } from '../services/api';

export default function JobsScreen() {
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.getAll(),
  });

  const handleCall = async (job: Job) => {
    if (!job.customer_phone) return;

    try {
      // Use VoIP API for click-to-call
      await voipApi.initiateCall({
        to_number: job.customer_phone,
        job_id: job.id,
      });
    } catch (error) {
      // Fallback to native phone
      Linking.openURL(`tel:${job.customer_phone}`);
    }
  };

  const handleNavigate = (job: Job) => {
    const address = encodeURIComponent(job.site_address);
    Linking.openURL(`https://maps.google.com/?q=${address}`);
  };

  const renderJob = ({ item: job }: { item: Job }) => (
    <TouchableOpacity style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <View>
          <Text style={styles.jobNumber}>{job.job_number}</Text>
          <Text style={styles.jobType}>{job.job_type}</Text>
        </View>
        <View style={[styles.statusBadge, getStatusStyle(job.status)]}>
          <Text style={[styles.statusText, getStatusTextStyle(job.status)]}>
            {job.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <Text style={styles.customerName}>{job.customer_name}</Text>

      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={16} color="#6b7280" />
        <Text style={styles.address} numberOfLines={2}>
          {job.site_address}
        </Text>
      </View>

      {job.scheduled_date && (
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.date}>
            {new Date(job.scheduled_date).toLocaleDateString()}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {job.customer_phone && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCall(job)}
          >
            <Ionicons name="call" size={20} color="#3b82f6" />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate(job)}
        >
          <Ionicons name="navigate" size={20} color="#10b981" />
          <Text style={[styles.actionText, { color: '#10b981' }]}>Navigate</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="document-text" size={20} color="#8b5cf6" />
          <Text style={[styles.actionText, { color: '#8b5cf6' }]}>Details</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No jobs found</Text>
          </View>
        }
      />
    </View>
  );
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'open':
      return { backgroundColor: '#dbeafe' };
    case 'in_progress':
      return { backgroundColor: '#fef3c7' };
    case 'completed':
      return { backgroundColor: '#d1fae5' };
    case 'urgent':
      return { backgroundColor: '#fee2e2' };
    default:
      return { backgroundColor: '#f3f4f6' };
  }
};

const getStatusTextStyle = (status: string) => {
  switch (status) {
    case 'open':
      return { color: '#1d4ed8' };
    case 'in_progress':
      return { color: '#d97706' };
    case 'completed':
      return { color: '#059669' };
    case 'urgent':
      return { color: '#dc2626' };
    default:
      return { color: '#4b5563' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  jobType: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  address: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
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
