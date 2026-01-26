import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, setHours, setMinutes, startOfDay, addHours } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ScheduleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentScheduledAt: string | null;
  dealId: string;
  onSave: (dealId: string, newDate: Date) => Promise<void>;
  isSaving: boolean;
}

export function ScheduleEditDialog({
  open,
  onOpenChange,
  currentScheduledAt,
  dealId,
  onSave,
  isSaving,
}: ScheduleEditDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedHour, setSelectedHour] = useState<string>('12');

  useEffect(() => {
    if (open) {
      if (currentScheduledAt) {
        const date = new Date(currentScheduledAt);
        setSelectedDate(date);
        setSelectedHour(date.getHours().toString().padStart(2, '0'));
      } else {
        // Default to tomorrow at 12:00
        const tomorrow = addHours(startOfDay(new Date()), 36);
        setSelectedDate(tomorrow);
        setSelectedHour('12');
      }
    }
  }, [open, currentScheduledAt]);

  const handleSave = async () => {
    if (!selectedDate) return;
    
    const newDate = setMinutes(setHours(selectedDate, parseInt(selectedHour)), 0);
    await onSave(dealId, newDate);
    onOpenChange(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => 
    i.toString().padStart(2, '0')
  );

  const getScheduledDateTime = () => {
    if (!selectedDate) return null;
    return setMinutes(setHours(selectedDate, parseInt(selectedHour)), 0);
  };

  const scheduledDateTime = getScheduledDateTime();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CalendarIcon className="h-5 w-5" />
            Изменить дату публикации
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ru}
              disabled={(date) => date < startOfDay(new Date())}
              className="rounded-md border border-border pointer-events-auto"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Время публикации
            </label>
            <Select value={selectedHour} onValueChange={setSelectedHour}>
              <SelectTrigger className="w-full bg-background border-border">
                <SelectValue placeholder="Выберите час" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-60">
                {hours.map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scheduledDateTime && (
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Новая дата публикации:</p>
              <p className="text-lg font-semibold text-foreground">
                {format(scheduledDateTime, "d MMMM yyyy 'в' HH:mm", { locale: ru })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedDate || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Сохранить'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
