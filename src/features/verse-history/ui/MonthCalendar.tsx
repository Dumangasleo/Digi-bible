import { addMonths, endOfMonth, format, getDay, parse, startOfMonth } from 'date-fns';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { toLocalDay } from '@/shared/utils/date';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

interface MonthCalendarProps {
  /** Displayed month as 'YYYY-MM'. */
  month: string;
  /** Day key ('YYYY-MM-DD') → number of readings that day. Missing means zero. */
  activity: Map<string, number>;
  /** Currently selected day key, or `null`. */
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  /** Called with the new 'YYYY-MM' when the user pages months. */
  onChangeMonth: (month: string) => void;
}

/**
 * Month grid with an activity dot on every day that has reading history.
 *
 * @param month - Month to render, 'YYYY-MM'.
 * @param activity - Per-day reading counts for that month.
 * @param selectedDay - Highlighted day, or `null` for none.
 * @param onSelectDay - Fired with the tapped day key.
 * @param onChangeMonth - Fired with the adjacent month key on paging.
 * @returns The calendar grid.
 * @remarks Hand-built rather than pulling in a calendar package: the whole
 *          requirement is 42 pressable cells and a dot, and a dependency would
 *          cost more in bundle size and theming friction than it saves.
 *
 *          Cells are keyed and compared by the `'YYYY-MM-DD'` **string**, never
 *          by `Date` identity. Two `Date` objects for the same day are never
 *          `===`, and comparing them by `getTime()` drags in time-of-day and
 *          DST edge cases that this view has no business knowing about.
 *
 *          The leading blanks come from `getDay()` of the first of the month,
 *          which is the weekday index in the device's locale-independent
 *          Sunday-first numbering — matching the `WEEKDAYS` header.
 */
export function MonthCalendar({
  month,
  activity,
  selectedDay,
  onSelectDay,
  onChangeMonth,
}: MonthCalendarProps) {
  const today = toLocalDay();

  // Recomputed only when the month changes — not on every activity tick.
  const { label, leadingBlanks, dayKeys } = useMemo(() => {
    const first = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
    const last = endOfMonth(first);
    const keys: string[] = [];
    for (let d = 1; d <= last.getDate(); d++) {
      keys.push(`${month}-${String(d).padStart(2, '0')}`);
    }
    return {
      label: format(first, 'MMMM yyyy'),
      leadingBlanks: getDay(startOfMonth(first)),
      dayKeys: keys,
    };
  }, [month]);

  /**
   * Pages the calendar by whole months.
   *
   * @param delta - `-1` for the previous month, `+1` for the next.
   */
  function shiftMonth(delta: number) {
    const first = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
    onChangeMonth(format(addMonths(first, delta), 'yyyy-MM'));
  }

  return (
    <View className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable onPress={() => shiftMonth(-1)} className="px-3 py-1">
          <Text className="text-xl text-brand-500">‹</Text>
        </Pressable>
        <Text className="text-base font-bold text-neutral-900 dark:text-white">{label}</Text>
        <Pressable onPress={() => shiftMonth(1)} className="px-3 py-1">
          <Text className="text-xl text-brand-500">›</Text>
        </Pressable>
      </View>

      <View className="mb-1 flex-row">
        {WEEKDAYS.map((weekday, index) => (
          <View key={`${weekday}-${index}`} className="flex-1 items-center">
            <Text className="text-xs font-semibold text-neutral-400">{weekday}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} className="h-11 w-[14.28%]" />
        ))}

        {dayKeys.map((dayKey) => {
          const count = activity.get(dayKey) ?? 0;
          const isSelected = dayKey === selectedDay;
          const isToday = dayKey === today;

          return (
            <Pressable
              key={dayKey}
              onPress={() => onSelectDay(dayKey)}
              className="h-11 w-[14.28%] items-center justify-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  isSelected ? 'bg-brand-500' : isToday ? 'bg-brand-100 dark:bg-brand-900/50' : ''
                }`}>
                <Text
                  className={`text-sm ${
                    isSelected
                      ? 'font-bold text-white'
                      : 'text-neutral-800 dark:text-neutral-200'
                  }`}>
                  {Number(dayKey.slice(-2))}
                </Text>
              </View>
              <View
                className={`mt-0.5 h-1 w-1 rounded-full ${
                  count > 0 ? (isSelected ? 'bg-brand-300' : 'bg-brand-500') : 'bg-transparent'
                }`}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
