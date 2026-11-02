import axios from 'axios';
import { Date } from '../utils.js';

export const RAPID_API_HOST = 'booking-com15.p.rapidapi.com';
export const BASE_URL = 'https://booking-com15.p.rapidapi.com';
export const DEFAULT_CURRENCY = 'INR';

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
 * Search for hotels near the specified coordinates.
 * Calls https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotelsByCoordinates
 *
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {Date|{year: number, month: number, day: number}|string} arrivalDate - Arrival date
 * @param {Date|{year: number, month: number, day: number}|string} departureDate - Departure date
 * @param {number} adults - Number of adult guests
 * @param {number} roomQty - Number of rooms requested
 * @returns {Promise<Array<object>>} List of hotel search results
 */
export async function getHotelByCoordinates(
  latitude,
  longitude,
  arrivalDate,
  departureDate,
  adults,
  roomQty
) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment');
  }

  const arrival = formatDate(arrivalDate);
  const departure = formatDate(departureDate);

  const response = await axios.get(`${BASE_URL}/api/v1/hotels/searchHotelsByCoordinates`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPID_API_HOST,
    },
    params: {
      latitude: String(latitude),
      longitude: String(longitude),
      arrival_date: arrival,
      departure_date: departure,
      adults: String(adults),
      room_qty: String(roomQty),
      units: 'metric',
      page_number: '1',
      temperature_unit: 'c',
      languagecode: 'en-us',
      currency_code: DEFAULT_CURRENCY,
    },
  });

  const raw = response.data;
  if (raw?.status !== true) {
    const msg = typeof raw?.message === 'object' ? JSON.stringify(raw.message) : (raw?.message || 'Unknown error');
    throw new Error(`Hotel Search API error: ${msg}`);
  }

  return raw?.data?.result || [];
}

/**
 * Get detailed information for a specific hotel, including address, facilities, pricing, and rooms.
 * Calls https://booking-com15.p.rapidapi.com/api/v1/hotels/getHotelDetails
 *
 * @param {string|number} hotelId - The hotel identifier
 * @param {Date|{year: number, month: number, day: number}|string} arrivalDate - Check-in date
 * @param {Date|{year: number, month: number, day: number}|string} departureDate - Check-out date
 * @param {number} adults - Number of adults
 * @param {string|string[]} [childrenAge] - Comma-separated or array of children ages
 * @param {number} roomQty - Number of rooms
 * @returns {Promise<object>} Structured HotelDetails object
 */
export async function getHotelDetails(
  hotelId,
  arrivalDate,
  departureDate,
  adults,
  childrenAge,
  roomQty
) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment');
  }

  const arrival = formatDate(arrivalDate);
  const departure = formatDate(departureDate);

  const params = {
    hotel_id: String(hotelId),
    arrival_date: arrival,
    departure_date: departure,
    languagecode: 'en-us',
    currency_code: DEFAULT_CURRENCY,
    adults: String(adults),
    room_qty: String(roomQty),
  };

  if (childrenAge !== undefined && childrenAge !== null && childrenAge !== '') {
    params.children_age = Array.isArray(childrenAge) ? childrenAge.join(',') : String(childrenAge);
  }

  const response = await axios.get(`${BASE_URL}/api/v1/hotels/getHotelDetails`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPID_API_HOST,
    },
    params,
  });

  const raw = response.data;
  if (raw?.status !== true) {
    const msg = typeof raw?.message === 'object' ? JSON.stringify(raw.message) : (raw?.message || 'Unknown error');
    throw new Error(`Hotel Details API error: ${msg}`);
  }

  const d = raw.data || {};

  // Extract price from nested product_price_breakdown
  const priceRounded = d.product_price_breakdown?.all_inclusive_amount_hotel_currency?.amount_rounded || null;

  // Flatten property highlights to just names
  const propertyHighlights = Array.isArray(d.property_highlight_strip)
    ? d.property_highlight_strip.map((item) => item?.name).filter(Boolean)
    : null;

  // Flatten top facilities to just names
  const topFacilities = Array.isArray(d.facilities_block?.facilities)
    ? d.facilities_block.facilities.map((fac) => fac?.name).filter(Boolean)
    : null;

  // Family facilities directly as string array
  const familyFacilities = Array.isArray(d.family_facilities)
    ? d.family_facilities
    : null;

  // Build structured RoomInfo for each room in rooms map
  let rooms = [];
  if (d.rooms && typeof d.rooms === 'object') {
    rooms = Object.entries(d.rooms).map(([roomId, roomVal]) => {
      const description = roomVal?.description || null;

      // Room highlights from translated_name
      const highlights = Array.isArray(roomVal?.highlights)
        ? roomVal.highlights.map((h) => h?.translated_name || h?.name).filter(Boolean)
        : [];

      // Bed configuration: concatenate name_with_count + description per bed type
      let bedConfiguration = null;
      const bedTypes = roomVal?.bed_configurations?.[0]?.bed_types;
      if (Array.isArray(bedTypes)) {
        const beds = bedTypes.map((b) => {
          const name = b?.name_with_count || b?.name || '';
          const desc = b?.description || '';
          return desc ? `${name} (${desc})` : name;
        }).filter(Boolean);
        if (beds.length > 0) {
          bedConfiguration = beds.join(', ');
        }
      }

      // Group facilities by alt_facilitytype_name
      const groupsMap = new Map();
      if (Array.isArray(roomVal?.facilities)) {
        for (const fac of roomVal.facilities) {
          const category = fac?.alt_facilitytype_name || 'General';
          const name = fac?.name || '';
          if (name) {
            if (!groupsMap.has(category)) {
              groupsMap.set(category, []);
            }
            groupsMap.get(category).push(name);
          }
        }
      }
      const facilityGroups = Array.from(groupsMap.entries())
        .map(([category, amenities]) => ({ category, amenities }))
        .sort((a, b) => a.category.localeCompare(b.category));

      // Collect photo URLs (url_max300 preferred, fallback to url_original)
      const photoUrls = Array.isArray(roomVal?.photos)
        ? roomVal.photos.map((p) => p?.url_max300 || p?.url_original).filter(Boolean)
        : [];

      return {
        room_id: roomId,
        description,
        highlights,
        bed_configuration: bedConfiguration,
        facility_groups: facilityGroups,
        photo_urls: photoUrls,
      };
    });
  }

  return {
    hotel_id: d.hotel_id,
    hotel_name: d.hotel_name,
    arrival_date: d.arrival_date || null,
    departure_date: d.departure_date || null,
    latitude: d.latitude,
    longitude: d.longitude,
    address: d.address || null,
    city: d.city || null,
    review_nr: d.review_nr ?? null,
    price_rounded: priceRounded,
    property_highlights: propertyHighlights,
    top_facilities: topFacilities,
    family_facilities: familyFacilities,
    rooms,
    url: d.url,
  };
}

/**
 * Check room availability and pricing for a specific hotel over a date range.
 * Calls https://booking-com15.p.rapidapi.com/api/v1/hotels/getAvailability
 *
 * @param {string|number} hotelId - The hotel identifier
 * @param {Date|{year: number, month: number, day: number}|string} arrivalDate - Check-in date
 * @param {Date|{year: number, month: number, day: number}|string} departureDate - Check-out date
 * @param {number} adults - Number of adults
 * @param {number} roomQty - Number of rooms
 * @returns {Promise<object>} Object with av_dates, lengths_of_stay, and currency
 */
export async function getRoomAvailability(
  hotelId,
  arrivalDate,
  departureDate,
  adults,
  roomQty
) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment');
  }

  const arrival = formatDate(arrivalDate);
  const departure = formatDate(departureDate);

  const response = await axios.get(`${BASE_URL}/api/v1/hotels/getAvailability`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPID_API_HOST,
    },
    params: {
      hotel_id: String(hotelId),
      arrival_date: arrival,
      departure_date: departure,
      adults: String(adults),
      room_qty: String(roomQty),
      currency_code: DEFAULT_CURRENCY,
    },
  });

  const raw = response.data;
  const data = raw?.data || {};

  // Transform dynamic date keys into structured entries { date, price }
  const avDates = [];
  if (Array.isArray(data.avDates)) {
    for (const item of data.avDates) {
      if (item && typeof item === 'object') {
        for (const [date, price] of Object.entries(item)) {
          if (price !== null && price !== undefined) {
            avDates.push({
              date,
              price: Number(price),
            });
          }
        }
      }
    }
  }

  const lengthsOfStay = [];
  if (Array.isArray(data.lengthsOfStay)) {
    for (const item of data.lengthsOfStay) {
      if (item && typeof item === 'object') {
        for (const [date, stay] of Object.entries(item)) {
          if (stay !== null && stay !== undefined) {
            lengthsOfStay.push({
              date,
              price: Number(stay),
            });
          }
        }
      }
    }
  }

  return {
    av_dates: avDates,
    lengths_of_stay: lengthsOfStay,
    currency: data.currency || null,
  };
}

// Snake-case aliases matching Rust functions
export const get_hotel_by_coordinates = getHotelByCoordinates;
export const get_hotel_details = getHotelDetails;
export const get_room_availability = getRoomAvailability;
