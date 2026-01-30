import React from 'react';
import { format, addDays, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateTimeSelectorProps {
  selectedDate: Date;
  selectedHour: number;
  onDateChange: (date: Date) => void;
  onHourChange: (hour: number) => void;
  minHoursBeforePost?: number;
}

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  selectedDate,
  selectedHour,
  onDateChange,
  onHourChange,
  minHoursBeforePost = 0,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getMinAvailableHour = () => {
    const now = new Date();
    // Base minimum: 2 hours from now
    const baseMinHour = now.getHours() + 2;
    // Add channel's min_hours_before_post requirement
    const requiredMinHour = now.getHours() + Math.max(2, minHoursBeforePost);
    return Math.max(baseMinHour, requiredMinHour);
  };

  const getAvailableHours = () => {
    const now = new Date();
    
    // Минимальный час = текущий час + minHoursBeforePost (минимум 2)
    const minTotalHours = Math.max(2, minHoursBeforePost);
    
    // Рассчитываем абсолютное время минимальной публикации
    const minPublishTime = new Date(now.getTime() + minTotalHours * 60 * 60 * 1000);
    
    // Получаем начало выбранного дня
    const selectedDayStart = new Date(selectedDate);
    selectedDayStart.setHours(0, 0, 0, 0);
    
    // Получаем начало сегодняшнего дня
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    // Получаем начало дня минимальной публикации
    const minPublishDayStart = new Date(minPublishTime);
    minPublishDayStart.setHours(0, 0, 0, 0);
    
    // Если выбранный день раньше дня минимальной публикации - нет слотов
    if (selectedDayStart.getTime() < minPublishDayStart.getTime()) {
      return [];
    }
    
    // Если выбранный день = день минимальной публикации
    if (selectedDayStart.getTime() === minPublishDayStart.getTime()) {
      const minHour = minPublishTime.getHours();
      // Если есть минуты, округляем вверх до следующего часа
      const adjustedMinHour = minPublishTime.getMinutes() > 0 ? minHour + 1 : minHour;
      return hours.filter(hour => hour >= adjustedMinHour);
    }
    
    // Выбранный день позже минимального - все часы доступны
    return hours;
  };

  const availableHours = getAvailableHours();

  const startDateTime = new Date(selectedDate);
  startDateTime.setHours(selectedHour, 0, 0, 0);

  const endDateTime = addDays(startDateTime, 1);

  const formatDisplayDate = (date: Date) => {
    return format(date, "d MMMM yyyy", { locale: ru });
  };

  const formatSummaryDate = (date: Date) => {
    return format(date, "d MMM yyyy, HH:mm", { locale: ru });
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarIcon className="h-4 w-4 text-primary" />
          Дата публикации
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-12 rounded-xl bg-secondary/50 border-0",
                !selectedDate && "text-muted-foreground"
              )}
            >
              {selectedDate ? formatDisplayDate(selectedDate) : "Выберите дату"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[60]" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && onDateChange(date)}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Time Picker */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="h-4 w-4 text-primary" />
          Время начала
        </label>
        <Select
          value={selectedHour.toString()}
          onValueChange={(value) => onHourChange(parseInt(value))}
        >
          <SelectTrigger className="w-full h-12 rounded-xl bg-secondary/50 border-0">
            <SelectValue placeholder="Выберите время" />
          </SelectTrigger>
          <SelectContent className="z-[60] border-0">
            {availableHours.length > 0 ? (
              availableHours.map((hour) => (
                <SelectItem key={hour} value={hour.toString()}>
                  {formatHour(hour)}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-sm text-muted-foreground text-center">
                На сегодня нет доступных слотов
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Block */}
      <div className="bg-secondary/50 rounded-2xl p-4 border-2 border-dashed border-primary">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Начало:</span>
            <span className="font-medium text-foreground">
              {formatSummaryDate(startDateTime)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Конец:</span>
            <span className="font-medium text-foreground">
              {formatSummaryDate(endDateTime)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-border/50">
            <span className="text-muted-foreground">Длительность:</span>
            <span className="font-semibold text-primary">24 часа</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateTimeSelector;
