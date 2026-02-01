import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command?: string;
}

// Human-readable descriptions for cron jobs
export const CRON_JOB_DESCRIPTIONS: Record<string, string> = {
  'check-escrow-payments': 'Проверка платежей в эскроу',
  'publish-scheduled-posts': 'Публикация запланированных постов',
  'auto-refund-expired-deals': 'Возврат средств за истёкшие сделки',
  'complete-posted-deals': 'Завершение опубликованных сделок',
  'verify-post-integrity': 'Проверка целостности постов',
  'auto-timeout-deals': 'Таймаут просроченных сделок',
};

// Human-readable schedule descriptions
export function describeSchedule(schedule: string): string {
  const scheduleMap: Record<string, string> = {
    '*/5 * * * *': 'Каждые 5 минут',
    '*/10 * * * *': 'Каждые 10 минут',
    '*/15 * * * *': 'Каждые 15 минут',
    '*/30 * * * *': 'Каждые 30 минут',
    '0 * * * *': 'Каждый час',
    '15 * * * *': 'На 15-й минуте каждого часа',
    '30 * * * *': 'На 30-й минуте каждого часа',
    '45 * * * *': 'На 45-й минуте каждого часа',
    '30 */4 * * *': 'Каждые 4 часа',
    '0 */2 * * *': 'Каждые 2 часа',
    '0 */6 * * *': 'Каждые 6 часов',
    '0 */12 * * *': 'Каждые 12 часов',
    '0 0 * * *': 'Ежедневно в полночь',
  };
  
  return scheduleMap[schedule] || schedule;
}

export function useCronJobs() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('manage-cron-admin', {
        body: { action: 'list' },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setJobs(response.data?.data || []);
    } catch (err: any) {
      console.error('Error fetching cron jobs:', err);
      setError(err.message || 'Failed to fetch cron jobs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const toggleJob = async (jobid: number, active: boolean) => {
    try {
      const response = await supabase.functions.invoke('manage-cron-admin', {
        body: { action: 'toggle', jobid, active },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Update local state
      setJobs(prev => prev.map(job => 
        job.jobid === jobid ? { ...job, active } : job
      ));

      return { success: true };
    } catch (err: any) {
      console.error('Error toggling job:', err);
      return { error: err.message };
    }
  };

  const toggleAllJobs = async (active: boolean) => {
    try {
      const response = await supabase.functions.invoke('manage-cron-admin', {
        body: { action: 'toggle_all', active },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Update local state
      setJobs(prev => prev.map(job => ({ ...job, active })));

      return { success: true };
    } catch (err: any) {
      console.error('Error toggling all jobs:', err);
      return { error: err.message };
    }
  };

  const updateSchedule = async (jobid: number, schedule: string) => {
    try {
      const response = await supabase.functions.invoke('manage-cron-admin', {
        body: { action: 'update_schedule', jobid, schedule },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Update local state
      setJobs(prev => prev.map(job => 
        job.jobid === jobid ? { ...job, schedule } : job
      ));

      return { success: true };
    } catch (err: any) {
      console.error('Error updating schedule:', err);
      return { error: err.message };
    }
  };

  const allActive = jobs.length > 0 && jobs.every(job => job.active);
  const someActive = jobs.some(job => job.active);

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    toggleJob,
    toggleAllJobs,
    updateSchedule,
    allActive,
    someActive,
  };
}
