// Dashboard Screen - Quick Overview

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { jobsApi, Job } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardScreen() {
  const { user } = useAuth();

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.getAll(),
  });

  // Stats
  const openJobs = jobs.filter(j => j.status === 'open').length;
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress').length;
  const todayJobs = jobs.filter(j => {
    if (!j.scheduled_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return j.scheduled_date.startsWith(today);
  }).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
    >
      {/* Welcome */}
      <View style={styles.welcome}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#3b82f6' }]}>
          <Ionicons name="briefcase" size={24} color="#fff" />
          <Text style={styles.statNumber}>{openJobs}</Text>
          <Text style={styles.statLabel}>Open Jobs</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#f59e0b' }]}>
          <Ionicons name="construct" size={24} color="#fff" />
          <Text style={styles.statNumber}>{inProgressJobs}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#10b981' }]}>
          <Ionicons name="calendar" size={24} color="#fff" />
          <Text style={styles.statNumber}>{todayJobs}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#8b5cf6' }]}>
          <Ionicons name="list" size={24} color="#fff" />
          <Text style={styles.statNumber}>{jobs.length}</Text>
          <Text style={styles.statLabel}>Total Jobs</Text>
        </View>
      </View>

      {/* Today's Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        {jobs
          .filter(j => {
            if (!j.scheduled_date) return false;
            const today = new Date().toISOString().split('T')[0];
            return j.scheduled_date.startsWith(today);
          })
          .slice(0, 5)
          .map(job => (
            <TouchableOpacity key={job.id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobNumber}>{job.job_number}</Text>
                <View style={[styles.statusBadge, getStatusStyle(job.status)]}>
                  <Text style={styles.statusText}>{job.status}</Text>
                </View>
              </View>
              <Text style={styles.customerName}>{job.customer_name}</Text>
              <View style={styles.jobMeta}>
                <Ionicons name="location" size={14} color="#6b7280" />
                <Text style={styles.address} numberOfLines={1}>
                  {job.site_address}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

        {todayJobs === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No jobs scheduled for today</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
    default:
      return { backgroundColor: '#f3f4f6' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  welcome: {
    padding: 20,
    backgroundColor: '#3b82f6',
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    width: '47%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
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
    alignItems: 'center',
    marginBottom: 8,
  },
  jobNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 8,
    color: '#9ca3af',
  },
});
