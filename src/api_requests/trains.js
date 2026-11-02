import axios from 'axios';
import { Date } from '../utils.js';

export const RAPID_API_HOST = 'irctc1.p.rapidapi.com';

/**
 * Format a Date object, {year, month, day} object, or string into YYYY-MM-DD
 * @param {Date|{year: number, month: number, day: number}|string} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toYyyyMmDd();
  }
  if (typeof date === 'object') {
    if (typeof date.toYyyyMmDd === 'function') {
      return date.toYyyyMmDd();
    }
    if (typeof date.to_yyyy_mm_dd === 'function') {
      return date.to_yyyy_mm_dd();
    }
    if ('year' in date && 'month' in date && 'day' in date) {
      return new Date(date.year, date.month, date.day).toYyyyMmDd();
    }
  }
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return Date.fromYyyyMmDd(date).toYyyyMmDd();
  }
  return String(date);
}

/**
 * Indian Railways Station code with uppercase + alphanumeric validation.
 */
export class Station {
  /**
   * @param {string} code
   */
  constructor(code) {
    const str = String(code);
    if (str.length > 0 && /^[A-Z0-9]+$/.test(str)) {
      this.code = str;
    } else {
      throw new Error(`Invalid Station code: ${code}`);
    }
  }

  /**
   * Static factory equivalent to Rust Station::new
   * @param {string} code
   * @returns {Station}
   */
  static new(code) {
    return new Station(code);
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

/**
 * Returns authentication headers required for IRCTC RapidAPI requests.
 * @returns {{ 'X-RapidAPI-Key': string, 'X-RapidAPI-Host': string }}
 */
export function getHeaders() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment');
  }
  return {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': RAPID_API_HOST,
  };
}

/**
 * Search for trains running between two stations on a specific date.
 * Calls https://irctc1.p.rapidapi.com/api/v3/trainBetweenStations
 *
 * @param {Station|string} source - Origin railway station code (e.g. NDLS)
 * @param {Station|string} destination - Destination railway station code (e.g. BCT)
 * @param {Date|{year: number, month: number, day: number}|string} date - Date of journey
 * @returns {Promise<Array<object>>} List of train objects
 */
export async function trainsBetween(source, destination, date) {
  const formattedDate = formatDate(date);
  const fromCode = source instanceof Station ? source.toString() : String(source);
  const toCode = destination instanceof Station ? destination.toString() : String(destination);

  // Validate station codes
  new Station(fromCode);
  new Station(toCode);

  const url = 'https://irctc1.p.rapidapi.com/api/v3/trainBetweenStations';
  const response = await axios.get(url, {
    headers: getHeaders(),
    params: {
      fromStationCode: fromCode,
      toStationCode: toCode,
      dateOfJourney: formattedDate,
    },
  });

  return response.data?.data || [];
}

/**
 * Check seat availability and status for a specific train and class.
 * Calls https://irctc1.p.rapidapi.com/api/v2/checkSeatAvailability
 *
 * @param {string|number} trainNumber - Train number (e.g. "12952")
 * @param {Station|string} fromStation - Origin station code (e.g. "NDLS")
 * @param {Station|string} toStation - Destination station code (e.g. "MMCT")
 * @param {Date|{year: number, month: number, day: number}|string} date - Journey date
 * @param {string} classType - Class code (e.g. "3A", "2A", "SL")
 * @param {string} quota - Quota code (e.g. "GN", "TQ")
 * @returns {Promise<Array<object>>} List of availability details
 */
export async function trainSeatsAvailable(
  trainNumber,
  fromStation,
  toStation,
  date,
  classType,
  quota
) {
  const formattedDate = formatDate(date);
  const fromCode = fromStation instanceof Station ? fromStation.toString() : String(fromStation);
  const toCode = toStation instanceof Station ? toStation.toString() : String(toStation);

  // Validate station codes
  new Station(fromCode);
  new Station(toCode);

  const url = 'https://irctc1.p.rapidapi.com/api/v2/checkSeatAvailability';
  const response = await axios.get(url, {
    headers: getHeaders(),
    params: {
      classType: String(classType),
      quota: String(quota),
      trainNo: String(trainNumber),
      date: formattedDate,
      fromStationCode: fromCode,
      toStationCode: toCode,
    },
  });

  return response.data?.data || [];
}

// Snake-case aliases matching Rust functions
export const trains_between = trainsBetween;
export const train_seats_available = trainSeatsAvailable;
export const get_headers = getHeaders;
