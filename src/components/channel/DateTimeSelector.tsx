import React from 'react';
import { format, addDays } from 'date-fns';
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
}

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  selectedDate,
  selectedHour,
  onDateChange,
  onHourChange,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

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
          <SelectContent className="z-[60]">
            {hours.map((hour) => (
              <SelectItem key={hour} value={hour.toString()}>
                {formatHour(hour)}
              </SelectItem>
            ))}
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
