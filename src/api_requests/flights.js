import axios from 'axios';
import { Date } from '../utils.js';

export const RAPID_API_HOST = 'google-flights2.p.rapidapi.com';
export const BASE_URL = 'https://google-flights2.p.rapidapi.com';
export const TOKEN_PREFIX = 'TOKEN_';

export const TravelClass = Object.freeze({
  ECONOMY: 'ECONOMY',
  PREMIUMECONOMY: 'PREMIUMECONOMY',
  BUSINESS: 'BUSINESS',
  FIRST: 'FIRST',
});

export const SearchType = Object.freeze({
  Cheap: 'cheap',
  Best: 'best',
});

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
 * Adds token to array and returns placeholder like TOKEN_0.
 * @param {string[]} tokenMap - Token storage array
 * @param {string} token - The raw token string
 * @returns {string} Placeholder token
 */
export function updateTokenMap(tokenMap, token) {
  if (!Array.isArray(tokenMap)) {
    throw new TypeError('tokenMap must be an array');
  }
  const placeholder = `${TOKEN_PREFIX}${tokenMap.length}`;
  tokenMap.push(String(token));
  return placeholder;
}

/**
 * Resolves TOKEN_N placeholder back to the actual token.
 * @param {string[]} tokenMap - Token storage array
 * @param {string} placeholder - e.g. "TOKEN_0"
 * @returns {string} The actual token string
 */
export function resolveToken(tokenMap, placeholder) {
  if (!Array.isArray(tokenMap)) {
    throw new TypeError('tokenMap must be an array');
  }
  if (typeof placeholder !== 'string' || !placeholder.startsWith(TOKEN_PREFIX)) {
    throw new Error(`Invalid token provided: ${placeholder}`);
  }
  const idx = Number.parseInt(placeholder.slice(TOKEN_PREFIX.length), 10);
  if (Number.isNaN(idx) || idx < 0 || idx >= tokenMap.length) {
    throw new Error(`Invalid token provided: ${placeholder}`);
  }
  return tokenMap[idx];
}

/**
 * Removes airline_logo and carbon_emissions from each itinerary and flight,
 * and replaces booking_token with a placeholder.
 * @param {Array<object>} itineraries - List of flight itineraries
 * @param {string[]} tokenMap - Array tracking token mappings
 * @returns {Array<object>} The modified itineraries array
 */
export function cleanAndReplaceTokens(itineraries, tokenMap) {
  if (!Array.isArray(itineraries)) {
    throw new Error('Invalid response. Itinerary not found');
  }
  for (const itinerary of itineraries) {
    if (itinerary && typeof itinerary === 'object') {
      if (Array.isArray(itinerary.flights)) {
        for (const flight of itinerary.flights) {
          if (flight && typeof flight === 'object') {
            delete flight.airline_logo;
          }
        }
      }
      delete itinerary.airline_logo;
      delete itinerary.carbon_emissions;
      if (itinerary.booking_token !== undefined && itinerary.booking_token !== null) {
        const smallToken = updateTokenMap(tokenMap, String(itinerary.booking_token));
        itinerary.booking_token = smallToken;
      }
    }
  }
  return itineraries;
}

/**
 * Search for one-way flights between two cities on a specific date.
 * Calls https://google-flights2.p.rapidapi.com/api/v1/searchFlights
 *
 * @param {string} origin - Starting airport IATA code (e.g. DEL)
 * @param {string} destination - Destination airport IATA code (e.g. BOM)
 * @param {Date|{year: number, month: number, day: number}|string} date - Outbound date
 * @param {string} travelClass - ECONOMY, PREMIUMECONOMY, BUSINESS, FIRST
 * @param {number} adults - Number of adult passengers
 * @param {string[]} [tokenMap=[]] - Token map array to store booking tokens
 * @param {number} [children=0] - Number of child passengers
 * @param {number} [infantOnLap] - Infants on lap
 * @param {number} [infantInSeat] - Infants in separate seat
 * @param {string} [searchType='cheap'] - 'cheap' or 'best'
 * @returns {Promise<Array<object>>} Filtered and token-replaced flight itineraries
 */
export async function flightsBetween(
  origin,
  destination,
  date,
  travelClass,
  adults,
  tokenMap = [],
  children = 0,
  infantOnLap,
  infantInSeat,
  searchType = 'cheap'
) {
  // Support flexible argument shifting if tokenMap was omitted
  if (typeof tokenMap === 'number') {
    searchType = infantInSeat || 'cheap';
    infantInSeat = infantOnLap;
    infantOnLap = children;
    children = tokenMap;
    tokenMap = [];
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment');
  }

  const formattedDate = formatDate(date);
  const travelClassStr = String(travelClass || 'ECONOMY').toUpperCase();
  const searchTypeStr = typeof searchType === 'string' ? searchType.toLowerCase() : 'cheap';

  const params = {
    departure_id: String(origin),
    arrival_id: String(destination),
    outbound_date: formattedDate,
    currency: 'INR',
    country_code: 'IN',
    adults: String(adults ?? 1),
    travel_class: travelClassStr,
    children: String(children ?? 0),
    search_type: searchTypeStr,
  };

  if (infantOnLap !== undefined && infantOnLap !== null) {
    params.infant_on_lap = String(infantOnLap);
  }
  if (infantInSeat !== undefined && infantInSeat !== null) {
    params.infant_in_seat = String(infantInSeat);
  }

  const response = await axios.get(`${BASE_URL}/api/v1/searchFlights`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPID_API_HOST,
    },
    params,
  });

  const responseData = response.data;
  const itineraries = responseData?.data?.itineraries || responseData?.itineraries || {};

  const topFlights = Array.isArray(itineraries.topFlights) ? [...itineraries.topFlights] : [];
  const flights = topFlights;

  if (Array.isArray(itineraries.otherFlights) && itineraries.otherFlights.length > 0) {
    const others = [...itineraries.otherFlights];
    others.sort((a, b) => {
      const pa = typeof a.price === 'number' ? a.price : Number.POSITIVE_INFINITY;
      const pb = typeof b.price === 'number' ? b.price : Number.POSITIVE_INFINITY;
      return pa - pb;
    });
    flights.push(...others.slice(0, 3));
  }

  if (flights.length === 0) {
    throw new Error(`No flight itineraries found for ${origin} to ${destination} on ${formattedDate}`);
  }

  cleanAndReplaceTokens(flights, tokenMap);
  return flights;
}

/**
 * Get detailed booking options for a specific flight itinerary.
 * Calls https://google-flights2.p.rapidapi.com/api/v1/getBookingDetails
 *
 * @param {string} bookingToken - Raw or placeholder booking token
 * @param {string[]} [tokenMap=[]] - Token storage array
 * @returns {Promise<Array<object>>} Array of booking options with token placeholders
 */
export async function bookingDetails(bookingToken, tokenMap = []) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment');
  }

  let resolvedToken = bookingToken;
  if (typeof bookingToken === 'string' && bookingToken.startsWith(TOKEN_PREFIX) && Array.isArray(tokenMap)) {
    try {
      resolvedToken = resolveToken(tokenMap, bookingToken);
    } catch (_) {
      // Fallback to bookingToken if resolution is not possible
    }
  }

  const response = await axios.get(`${BASE_URL}/api/v1/getBookingDetails`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPID_API_HOST,
    },
    params: {
      booking_token: resolvedToken,
      currency: 'INR',
      country_code: 'IN',
    },
  });

  const data = response.data?.data;
  if (!Array.isArray(data)) {
    throw new Error('data not found');
  }

  for (const option of data) {
    if (option && typeof option === 'object' && option.token) {
      const smallToken = updateTokenMap(tokenMap, String(option.token));
      option.token = smallToken;
    }
  }

  return data;
}

/**
 * Get the final booking redirect URL for a flight booking option.
 * Calls https://google-flights2.p.rapidapi.com/api/v1/getBookingURL
 *
 * @param {string} token - Raw or placeholder token
 * @param {string[]} [tokenMap] - Optional token map for resolving placeholder
 * @returns {Promise<string>} The booking checkout URL
 */
export async function flightBookingLink(token, tokenMap) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment');
  }

  let resolvedToken = token;
  if (typeof token === 'string' && token.startsWith(TOKEN_PREFIX) && Array.isArray(tokenMap)) {
    try {
      resolvedToken = resolveToken(tokenMap, token);
    } catch (_) {
      // Fallback to token if resolution fails
    }
  }

  const response = await axios.get(`${BASE_URL}/api/v1/getBookingURL`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPID_API_HOST,
    },
    params: {
      token: resolvedToken,
    },
  });

  if (typeof response.data?.data === 'string') {
    return response.data.data;
  }
  if (typeof response.data === 'string') {
    return response.data;
  }

  throw new Error(`Booking Link Error: ${JSON.stringify(response.data)}`);
}

// Compatibility and snake_case aliases matching Rust functions
export const update_token_map = updateTokenMap;
export const resolve_token = resolveToken;
export const clean_and_replace_tokens = cleanAndReplaceTokens;
export const flights_between = flightsBetween;
export const between = flightsBetween;
export const booking_details = bookingDetails;
export const flight_booking_details = bookingDetails;
export const flight_booking_link = flightBookingLink;
