import {
  flightsBetween,
  bookingDetails,
  flightBookingLink,
  resolveToken,
  trainsBetween,
  trainSeatsAvailable,
  getAboutPlace,
  getHotelByCoordinates,
  getHotelDetails,
  getRoomAvailability,
} from './api_requests/index.js';

/**
 * Dispatch an individual function call to the corresponding API function.
 *
 * @param {string} name - The tool function name
 * @param {object} args - Arguments passed by Gemini
 * @param {string[]} tokenMap - Mutable token map for flight booking tokens
 * @returns {Promise<any>} Result of the API call
 */
async function dispatchCall(name, args = {}, tokenMap = []) {
  switch (name) {
    case 'flights_between': {
      const origin = args.origin;
      const destination = args.destination || args.dest;
      const date = args.date;
      const travelClass = args.travel_class || args.travelClass || 'ECONOMY';
      const adults = args.adults ?? 1;
      const children = args.children ?? 0;
      const infantOnLap = args.infant_on_lap ?? args.infantOnLap ?? null;
      const infantInSeat = args.infant_in_seat ?? args.infantInSeat ?? null;
      const searchType = args.search_type || args.searchType || 'cheap';

      return await flightsBetween(
        origin,
        destination,
        date,
        travelClass,
        adults,
        tokenMap,
        children,
        infantOnLap,
        infantInSeat,
        searchType
      );
    }

    case 'flight_booking_details': {
      const bookingToken = args.booking_token || args.bookingToken;
      const resolvedToken = resolveToken(tokenMap, bookingToken);
      return await bookingDetails(resolvedToken, tokenMap);
    }

    case 'flight_booking_link': {
      const originalToken = args.token;
      const resolvedToken = resolveToken(tokenMap, originalToken);
      const url = await flightBookingLink(resolvedToken, tokenMap);
      return {
        url_for: originalToken,
        url,
      };
    }

    case 'trains_between': {
      const source = args.source;
      const dest = args.destination || args.dest;
      const date = args.date;
      return await trainsBetween(source, dest, date);
    }

    case 'train_seats_available': {
      const trainNumber = args.train_number || args.trainNumber;
      const from = args.from_station || args.from || args.fromStation;
      const to = args.to_station || args.to || args.toStation;
      const date = args.date;
      const classType = args.class || args.class_type || args.classType;
      const quota = args.quota;
      return await trainSeatsAvailable(trainNumber, from, to, date, classType, quota);
    }

    case 'get_about_place': {
      const query = args.query;
      const maxResults = args.max_results ?? args.maxResults ?? 10;
      const fields = args.fields ?? [];
      return await getAboutPlace(query, maxResults, fields);
    }

    case 'get_hotel_by_coordinates': {
      const lat = args.latitude ?? args.lat;
      const lng = args.longitude ?? args.lng;
      const arrivalDate = args.arrival_date || args.arrivalDate;
      const departureDate = args.departure_date || args.departureDate;
      const adults = args.adults ?? 1;
      const roomQty = args.room_qty ?? args.roomQty ?? 1;
      return await getHotelByCoordinates(lat, lng, arrivalDate, departureDate, adults, roomQty);
    }

    case 'get_hotel_details': {
      const hotelId = args.hotel_id || args.hotelId;
      const arrivalDate = args.arrival_date || args.arrivalDate;
      const departureDate = args.departure_date || args.departureDate;
      const adults = args.adults ?? 1;
      const childrenAge = args.children_age ?? args.childrenAge ?? null;
      const roomQty = args.room_qty ?? args.roomQty ?? 1;
      return await getHotelDetails(hotelId, arrivalDate, departureDate, adults, childrenAge, roomQty);
    }

    case 'get_room_availability': {
      const hotelId = args.hotel_id || args.hotelId;
      const arrivalDate = args.arrival_date || args.arrivalDate;
      const departureDate = args.departure_date || args.departureDate;
      const adults = args.adults ?? 1;
      const roomQty = args.room_qty ?? args.roomQty ?? 1;
      return await getRoomAvailability(hotelId, arrivalDate, departureDate, adults, roomQty);
    }

    default:
      throw new Error(`Unknown function call: ${name}`);
  }
}

/**
 * Executes all function calls in the last model turn concurrently using Promise.all.
 * Appends a function response message to the session history.
 *
 * @param {Array<{role: string, parts: Array<any>}>} history - Chat history array
 * @param {string[]} tokenMap - Mutable token map for flight booking tokens
 * @returns {Promise<Array<{role: string, parts: Array<any>}>>} The modified history
 */
export async function executeCalls(history, tokenMap = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return history;
  }

  // 1. Get the last chat from the session history
  let targetChat = history[history.length - 1];

  // 2. If last role is 'function', get the previous chat (2nd from last)
  if (targetChat.role === 'function' && history.length >= 2) {
    targetChat = history[history.length - 2];
  }

  // 3. Collect all functionCall parts
  const functionCalls = [];
  if (Array.isArray(targetChat.parts)) {
    for (const part of targetChat.parts) {
      if (part && (part.functionCall || part.function_call)) {
        const call = part.functionCall || part.function_call;
        functionCalls.push({
          name: call.name,
          args: call.args || {},
        });
      }
    }
  }

  if (functionCalls.length === 0) {
    return history;
  }

  // 4 & 5. Dispatch all function calls concurrently using Promise.all
  const promises = functionCalls.map(async ({ name, args }) => {
    try {
      const result = await dispatchCall(name, args, tokenMap);
      // Ensure the response field is an object for Gemini API compliance
      const response =
        result !== null && typeof result === 'object' && !Array.isArray(result)
          ? result
          : { result };

      return {
        functionResponse: {
          name,
          response,
        },
      };
    } catch (err) {
      // 7. If a function errors, the error message is added as the response
      return {
        functionResponse: {
          name,
          response: {
            Error: err?.message || String(err),
          },
        },
      };
    }
  });

  const functionResponses = await Promise.all(promises);

  // 6. Results are added back to the session history as function responses
  history.push({
    role: 'function',
    parts: functionResponses,
  });

  return history;
}

// Snake-case alias matching Rust function execute_calls
export const execute_calls = executeCalls;
