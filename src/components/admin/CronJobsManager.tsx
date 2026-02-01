import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, Loader2, Pencil, RefreshCw, Power, PowerOff } from 'lucide-react';
import { useCronJobs, CRON_JOB_DESCRIPTIONS, describeSchedule } from '@/hooks/useCronJobs';
import { toast } from 'sonner';

export function CronJobsManager() {
  const { 
    jobs, 
    isLoading, 
    error, 
    fetchJobs, 
    toggleJob, 
    toggleAllJobs, 
    updateSchedule,
    allActive,
  } = useCronJobs();

  const [editingJob, setEditingJob] = useState<{ jobid: number; schedule: string } | null>(null);
  const [newSchedule, setNewSchedule] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [togglingJobId, setTogglingJobId] = useState<number | null>(null);
  const [isTogglingAll, setIsTogglingAll] = useState(false);

  const handleToggleJob = async (jobid: number, currentActive: boolean) => {
    setTogglingJobId(jobid);
    const result = await toggleJob(jobid, !currentActive);
    setTogglingJobId(null);
    
    if (result.error) {
      toast.error(`Ошибка: ${result.error}`);
    } else {
      toast.success(currentActive ? 'Задача выключена' : 'Задача включена');
    }
  };

  const handleToggleAll = async () => {
    setIsTogglingAll(true);
    const result = await toggleAllJobs(!allActive);
    setIsTogglingAll(false);
    
    if (result.error) {
      toast.error(`Ошибка: ${result.error}`);
    } else {
      toast.success(allActive ? 'Все задачи выключены' : 'Все задачи включены');
    }
  };

  const handleEditSchedule = (jobid: number, schedule: string) => {
    setEditingJob({ jobid, schedule });
    setNewSchedule(schedule);
  };

  const handleSaveSchedule = async () => {
    if (!editingJob) return;
    
    // Basic cron validation
    const cronPattern = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/;
    if (!cronPattern.test(newSchedule.trim())) {
      toast.error('Неверный формат cron-выражения');
      return;
    }

    setIsUpdating(true);
    const result = await updateSchedule(editingJob.jobid, newSchedule.trim());
    setIsUpdating(false);
    
    if (result.error) {
      toast.error(`Ошибка: ${result.error}`);
    } else {
      toast.success('Расписание обновлено');
      setEditingJob(null);
    }
  };

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Планировщик задач (Cron Jobs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchJobs} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Повторить
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Планировщик задач (Cron Jobs)
              </CardTitle>
              <CardDescription>
                Управление фоновыми задачами приложения
              </CardDescription>
            </div>
            <Button
              onClick={fetchJobs}
              variant="ghost"
              size="icon"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
            <div className="flex items-center gap-3">
              {allActive ? (
                <Power className="h-5 w-5 text-green-500" />
              ) : (
                <PowerOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-foreground">Все задачи</p>
                <p className="text-sm text-muted-foreground">
                  {allActive ? 'Все задачи активны' : 'Некоторые задачи отключены'}
                </p>
              </div>
            </div>
            {isLoading || isTogglingAll ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={allActive}
                onCheckedChange={handleToggleAll}
              />
            )}
          </div>

          {/* Jobs table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cron jobs не найдены</p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Расписание</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.jobid}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {CRON_JOB_DESCRIPTIONS[job.jobname] || job.jobname}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {job.jobname}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm text-foreground">
                            {job.schedule}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {describeSchedule(job.schedule)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          job.active 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            job.active ? 'bg-green-500' : 'bg-muted-foreground'
                          }`} />
                          {job.active ? 'Вкл' : 'Выкл'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSchedule(job.jobid, job.schedule)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {togglingJobId === job.jobid ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={job.active}
                              onCheckedChange={() => handleToggleJob(job.jobid, job.active)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Help text */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Формат cron:</strong> минуты часы дни месяцы дни_недели
            </p>
            <p>
              <strong>Примеры:</strong> */5 * * * * (каждые 5 мин), 0 * * * * (каждый час), 30 */4 * * * (каждые 4 часа)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit schedule dialog */}
      <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить расписание</DialogTitle>
            <DialogDescription>
              Введите cron-выражение для задачи
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Cron-выражение
              </label>
              <Input
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                placeholder="*/5 * * * *"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {describeSchedule(newSchedule)}
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-md">
              <p><strong>Формат:</strong> минуты часы дни месяцы дни_недели</p>
              <p>• */5 * * * * — каждые 5 минут</p>
              <p>• 0 * * * * — каждый час</p>
              <p>• 30 * * * * — на 30-й минуте каждого часа</p>
              <p>• 30 */4 * * * — каждые 4 часа на 30-й минуте</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)}>
              Отмена
            </Button>
            <Button onClick={handleSaveSchedule} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
