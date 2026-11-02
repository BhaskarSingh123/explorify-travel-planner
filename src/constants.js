import { Date } from './utils.js';

export const RETRY_COUNT = 3;

/**
 * Returns the system prompt for Explorify AI with today's date interpolated.
 * @returns {string}
 */
export function getTravelPlannerSysPrompt() {
  return `You are Explorify AI, the lead travel architect at Explorify Trips Pvt. Ltd. Your mission is to craft exceptional, data-driven travel itineraries that seamlessly integrate flights, trains, hotels, and local attractions.
Today's Date: ${Date.now()}

# Guidelines:
1. **Real-Time Precision**: Use the provided tools to fetch live data for flights, trains, and hotels. Never guess availability or prices. Use Tools provided.
2. **User Clarification**: In case of confusion of choices, ask the user for more clarification. Never make guesses.
3. **Professional Tone**: Maintain a helpful, knowledgeable, and professional demeanor.
4. **Visual Structure**: Use markdown features to present the plan clearly.
5. **Multi-Modal Travel**: Suggest a mix of flights and trains where appropriate to balance cost and time.

**Note**: trains tools don't give deep booking link so you need to generate one using the data provided by other tools. Link format https://www.irctc.co.in/nget/booking/train-list?trainNo=[TRAIN]&fromStn=[SRC]&toStn=[DEST]&journeyDate=[YYYYMMDD]&classCode=[CLASS]&quotaCode=[QUOTA]

# Output Protocol
1. **Clarification Mode**: If any clarification is needed, set all fields to \`null\` except \`message\`. Use \`message\` to prompt for the specific missing detail.
2. **Execution Mode**: Once information is complete, you must populate \`hotels\`, \`itinerary\`, and at least one transport field (\`flights\` or \`trains\`).
3. **Update previous plan**:
   - **Update/Overwrite**: Any non-null field (e.g., \`hotels: [...]\`) completely replaces the previous version of that data.
   - **Preserve**: If a field is \`null\`, the system will keep the data from the previous turn.
   However message field is appended and shown below the previous message.`;
}

/**
 * Reusable date parameter schema for function calling tools.
 */
const dateSchema = {
  type: 'object',
  description: 'Date representation with year, month, and day',
  properties: {
    year: {
      type: 'integer',
      description: 'Four-digit year (e.g. 2026)',
    },
    month: {
      type: 'integer',
      description: 'Month of the year (1-12)',
    },
    day: {
      type: 'integer',
      description: 'Day of the month (1-31)',
    },
  },
  required: ['year', 'month', 'day'],
};

/**
 * Gemini-compatible JSON schema for structured travel plan output.
 */
export const PLAN_OUTPUT_SCHEMA = {
  type: 'object',
  description: 'Structured output schema for the travel plan',
  properties: {
    outbound: {
      type: 'object',
      description: 'Outbound transport options (flights and/or trains)',
      properties: {
        flights: {
          type: 'array',
          description: 'Outbound flight options',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Flight or carrier name' },
              booking_link: { type: 'string', description: 'Deep booking URL' },
              price: { type: 'number', description: 'Price in INR' },
              departure_from_source: { type: 'string', description: 'Departure time in ISO 8601 format' },
              arrival_at_destination: { type: 'string', description: 'Arrival time in ISO 8601 format' },
              description: { type: 'string', description: 'Flight description, baggage and details' },
            },
            required: [
              'name',
              'booking_link',
              'price',
              'departure_from_source',
              'arrival_at_destination',
              'description',
            ],
          },
          nullable: true,
        },
        trains: {
          type: 'array',
          description: 'Outbound train options',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Train name and number' },
              booking_link: { type: 'string', description: 'Deep booking URL' },
              price: { type: 'number', description: 'Price in INR' },
              departure_from_source: { type: 'string', description: 'Departure time in ISO 8601 format' },
              arrival_at_destination: { type: 'string', description: 'Arrival time in ISO 8601 format' },
              description: { type: 'string', description: 'Train class, quota and details' },
            },
            required: [
              'name',
              'booking_link',
              'price',
              'departure_from_source',
              'arrival_at_destination',
              'description',
            ],
          },
          nullable: true,
        },
      },
      nullable: true,
    },
    inbound: {
      type: 'object',
      description: 'Inbound (return) transport options (flights and/or trains)',
      properties: {
        flights: {
          type: 'array',
          description: 'Inbound flight options',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Flight or carrier name' },
              booking_link: { type: 'string', description: 'Deep booking URL' },
              price: { type: 'number', description: 'Price in INR' },
              departure_from_source: { type: 'string', description: 'Departure time in ISO 8601 format' },
              arrival_at_destination: { type: 'string', description: 'Arrival time in ISO 8601 format' },
              description: { type: 'string', description: 'Flight description, baggage and details' },
            },
            required: [
              'name',
              'booking_link',
              'price',
              'departure_from_source',
              'arrival_at_destination',
              'description',
            ],
          },
          nullable: true,
        },
        trains: {
          type: 'array',
          description: 'Inbound train options',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Train name and number' },
              booking_link: { type: 'string', description: 'Deep booking URL' },
              price: { type: 'number', description: 'Price in INR' },
              departure_from_source: { type: 'string', description: 'Departure time in ISO 8601 format' },
              arrival_at_destination: { type: 'string', description: 'Arrival time in ISO 8601 format' },
              description: { type: 'string', description: 'Train class, quota and details' },
            },
            required: [
              'name',
              'booking_link',
              'price',
              'departure_from_source',
              'arrival_at_destination',
              'description',
            ],
          },
          nullable: true,
        },
      },
      nullable: true,
    },
    hotels: {
      type: 'array',
      description: 'Recommended hotel accommodations',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Hotel name' },
          booking_link: { type: 'string', description: 'Direct booking URL' },
          price: { type: 'number', description: 'Price in INR' },
          image_urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of image URLs for the hotel',
          },
          rating: { type: 'number', description: 'Hotel rating score' },
          description: { type: 'string', description: 'Hotel amenities and overview' },
        },
        required: ['name', 'booking_link', 'price', 'image_urls', 'rating', 'description'],
      },
      nullable: true,
    },
    itinerary: {
      type: 'array',
      description: 'Day-by-day sightseeing and activity itinerary',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title or heading for the activity/day' },
          google_map_url: { type: 'string', description: 'Google Maps location link', nullable: true },
          plan: { type: 'string', description: 'Detailed plan and activities' },
        },
        required: ['title', 'plan'],
      },
      nullable: true,
    },
    message: {
      type: 'string',
      description: 'Communication message to user or clarification prompt',
    },
  },
  required: ['outbound', 'inbound', 'message'],
};

/**
 * Array of 9 tool function declarations for Gemini function calling.
 */
export const TOOL_DECLARATIONS = [
  {
    name: 'flights_between',
    description: 'Search for one-way flights between two airport codes on a specific date.',
    parameters: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin airport IATA 3-letter code (e.g. DEL, BOM)',
        },
        destination: {
          type: 'string',
          description: 'Destination airport IATA 3-letter code (e.g. BLR, GOI)',
        },
        date: dateSchema,
        travel_class: {
          type: 'string',
          enum: ['ECONOMY', 'PREMIUMECONOMY', 'BUSINESS', 'FIRST'],
          description: 'Cabin travel class',
        },
        adults: {
          type: 'integer',
          description: 'Number of adult passengers (age 12+)',
        },
        children: {
          type: 'integer',
          description: 'Number of child passengers (age 2-11)',
        },
        infant_on_lap: {
          type: 'integer',
          description: 'Number of infants seated on lap (under 2 years)',
        },
        infant_in_seat: {
          type: 'integer',
          description: 'Number of infants in separate seats (under 2 years)',
        },
        search_type: {
          type: 'string',
          enum: ['Cheap', 'Best'],
          description: 'Search sorting preference (Cheap or Best)',
        },
      },
      required: ['origin', 'destination', 'date', 'travel_class', 'adults', 'children'],
    },
  },
  {
    name: 'flight_booking_details',
    description: 'Get booking options and price breakdown for a selected flight using its booking token.',
    parameters: {
      type: 'object',
      properties: {
        booking_token: {
          type: 'string',
          description: 'Booking token returned from flights_between search result',
        },
      },
      required: ['booking_token'],
    },
  },
  {
    name: 'flight_booking_link',
    description: 'Get the final booking redirect URL for a flight using a token.',
    parameters: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token to retrieve direct booking URL',
        },
      },
      required: ['token'],
    },
  },
  {
    name: 'trains_between',
    description: 'Search for trains running between source and destination stations on a specific date.',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source railway station code (e.g. NDLS, CSMT)',
        },
        destination: {
          type: 'string',
          description: 'Destination railway station code (e.g. BCT, HWH)',
        },
        date: dateSchema,
      },
      required: ['source', 'destination', 'date'],
    },
  },
  {
    name: 'train_seats_available',
    description: 'Check seat availability and reservation status for a specific train, date, class, and quota.',
    parameters: {
      type: 'object',
      properties: {
        train_number: {
          type: 'string',
          description: 'Indian Railways train number (e.g. "12952")',
        },
        from_station: {
          type: 'string',
          description: 'Boarding station code (e.g. "NDLS")',
        },
        to_station: {
          type: 'string',
          description: 'Destination station code (e.g. "MMCT")',
        },
        date: dateSchema,
        class: {
          type: 'string',
          description: 'Travel class code (e.g. "1A", "2A", "3A", "SL", "CC", "2S")',
        },
        quota: {
          type: 'string',
          description: 'Quota code (e.g. "GN" for General, "TQ" for Tatkal, "PT" for Premium Tatkal, "LD" for Ladies)',
        },
      },
      required: ['train_number', 'from_station', 'to_station', 'date', 'class', 'quota'],
    },
  },
  {
    name: 'get_about_place',
    description: 'Search places, tourist attractions, and landmarks using Google Places API.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text query searching for a landmark or place (e.g. "Taj Mahal, Agra")',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of results to return (1-20)',
          minimum: 1,
          maximum: 20,
        },
        fields: {
          type: 'array',
          description: 'List of place fields to retrieve',
          items: {
            type: 'string',
            enum: [
              'Id',
              'DisplayName',
              'FormattedAddress',
              'Location',
              'Rating',
              'UserRatingCount',
              'PriceLevel',
              'Types',
              'WebsiteUri',
              'RegularOpeningHours',
              'EditorialSummary',
              'Photos',
              'InternationalPhoneNumber',
              'Reviews',
            ],
          },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_hotel_by_coordinates',
    description: 'Search hotels near geographic coordinates for given dates and room occupancy.',
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude of the search area (e.g. 27.1751)',
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the search area (e.g. 78.0421)',
        },
        arrival_date: dateSchema,
        departure_date: dateSchema,
        adults: {
          type: 'integer',
          description: 'Total number of adult guests',
        },
        room_qty: {
          type: 'integer',
          description: 'Number of rooms requested',
        },
      },
      required: ['latitude', 'longitude', 'arrival_date', 'departure_date', 'adults', 'room_qty'],
    },
  },
  {
    name: 'get_hotel_details',
    description: 'Get detailed information, amenities, and room options for a specific hotel.',
    parameters: {
      type: 'object',
      properties: {
        hotel_id: {
          type: 'string',
          description: 'Unique identifier of the hotel',
        },
        arrival_date: dateSchema,
        departure_date: dateSchema,
        adults: {
          type: 'integer',
          description: 'Total number of adult guests',
        },
        children_age: {
          type: 'string',
          description: 'Comma-separated ages of children if applicable (e.g. "5,9")',
        },
        room_qty: {
          type: 'integer',
          description: 'Number of rooms requested',
        },
      },
      required: ['hotel_id', 'arrival_date', 'departure_date', 'adults', 'room_qty'],
    },
  },
  {
    name: 'get_room_availability',
    description: 'Check room availability, pricing, and rate policies for a specific hotel.',
    parameters: {
      type: 'object',
      properties: {
        hotel_id: {
          type: 'string',
          description: 'Unique identifier of the hotel',
        },
        arrival_date: dateSchema,
        departure_date: dateSchema,
        adults: {
          type: 'integer',
          description: 'Total number of adult guests',
        },
        room_qty: {
          type: 'integer',
          description: 'Number of rooms requested',
        },
      },
      required: ['hotel_id', 'arrival_date', 'departure_date', 'adults', 'room_qty'],
    },
  },
];
