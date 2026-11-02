import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Custom Date representation converted from Rust Date struct.
 */
export class Date {
  /**
   * @param {number} year 
   * @param {number} month (1-12)
   * @param {number} day (1-31)
   */
  constructor(year, month, day) {
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    const parsedDay = Number(day);

    if (parsedDay > 31) {
      throw new Error(`Day cannot be more than 31. Found: ${day}`);
    }
    if (parsedMonth > 12) {
      throw new Error(`Month cannot be more than 12. Found: ${month}`);
    }

    this.year = parsedYear;
    this.month = parsedMonth;
    this.day = parsedDay;
  }

  /**
   * Static factory equivalent to Rust Date::new
   * @param {number} year 
   * @param {number} month 
   * @param {number} day 
   * @returns {Date}
   */
  static new(year, month, day) {
    return new Date(year, month, day);
  }

  /**
   * Formats the date as YYYY-MM-DD
   * @returns {string}
   */
  toYyyyMmDd() {
    const y = String(this.year).padStart(4, '0');
    const m = String(this.month).padStart(2, '0');
    const d = String(this.day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Snake-case alias for toYyyyMmDd matching Rust to_yyyy_mm_dd
   * @returns {string}
   */
  to_yyyy_mm_dd() {
    return this.toYyyyMmDd();
  }

  /**
   * Static factory to parse YYYY-MM-DD formatted string.
   * @param {string} dateStr
   * @returns {Date}
   */
  static fromYyyyMmDd(dateStr) {
    if (typeof dateStr !== 'string') {
      throw new TypeError('Date must be a string');
    }
    const parts = dateStr.split('-');
    if (parts.length > 3) {
      throw new Error('Too many parameters in data');
    }
    if (parts.length < 3) {
      throw new Error('Invalid date format');
    }
    const [yearStr, monthStr, dayStr] = parts;
    if (!yearStr) throw new Error('Year not found');
    if (!monthStr) throw new Error('Month not found');
    if (!dayStr) throw new Error('Day not found');

    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const day = Number.parseInt(dayStr, 10);

    if (Number.isNaN(year)) throw new Error('Year not found');
    if (Number.isNaN(month)) throw new Error('Month not found');
    if (Number.isNaN(day)) throw new Error('Day not found');

    return new Date(year, month, day);
  }

  /**
   * Snake-case alias for fromYyyyMmDd matching Rust from_yyyy_mm_dd
   * @param {string} dateStr 
   * @returns {Date}
   */
  static from_yyyy_mm_dd(dateStr) {
    return Date.fromYyyyMmDd(dateStr);
  }

  /**
   * Returns current time formatted in IST timezone.
   * Equivalent to Rust: Utc::now() with IST (+05:30) formatted as "%a %b %e %H:%M:%S %Z %Y"
   * e.g., "Fri Oct 30 23:29:52 IST 2026"
   * @returns {string}
   */
  static now() {
    const istTime = dayjs().tz('Asia/Kolkata');
    const d = istTime.date();
    const dayStr = d < 10 ? ` ${d}` : `${d}`;
    return `${istTime.format('ddd MMM')} ${dayStr} ${istTime.format('HH:mm:ss')} IST ${istTime.format('YYYY')}`;
  }

  /**
   * Returns a Date instance representing the current local date.
   * @returns {Date}
   */
  static newNow() {
    const local = dayjs();
    return new Date(local.year(), local.month() + 1, local.date());
  }

  /**
   * Snake-case alias for newNow matching Rust new_now
   * @returns {Date}
   */
  static new_now() {
    return Date.newNow();
  }

  toJSON() {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
    };
  }

  toString() {
    return this.toYyyyMmDd();
  }
}

/**
 * Validated 3-letter uppercase IATA code converted from Rust IataCode struct.
 */
export class IataCode {
  /**
   * @param {string} code
   */
  constructor(code) {
    const str = String(code);
    if (str.length <= 3 && [...str].every((c) => c >= 'A' && c <= 'Z')) {
      this.code = str;
    } else {
      throw new Error(`Invalid IATA code: ${code}`);
    }
  }

  /**
   * Static factory equivalent to Rust IataCode::new
   * @param {string} code
   * @returns {IataCode}
   */
  static new(code) {
    return new IataCode(code);
  }

  toString() {
    return this.code;
  }

  toJSON() {
    return this.code;
  }

  valueOf() {
    return this.code;
  }
}
