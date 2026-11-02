import axios from 'axios';

/**
 * Fields that can be requested for a place. Each field adds more detail to the response.
 */
export const PlaceField = Object.freeze({
  Id: 'places.id',
  DisplayName: 'places.displayName',
  FormattedAddress: 'places.formattedAddress',
  Location: 'places.location',
  Rating: 'places.rating',
  UserRatingCount: 'places.userRatingCount',
  PriceLevel: 'places.priceLevel',
  Types: 'places.types',
  WebsiteUri: 'places.websiteUri',
  RegularOpeningHours: 'places.regularOpeningHours',
  EditorialSummary: 'places.editorialSummary',
  Photos: 'places.photos',
  InternationalPhoneNumber: 'places.internationalPhoneNumber',
  Reviews: 'places.reviews',
});

export const PLACEHOLDER_API_KEY = 'placeholder_api_key';

/**
 * Constructs media URL for a place photo reference using the placeholder API key.
 * @param {string} photoName - Photo resource name e.g. "places/ChIJ.../photos/..."
 * @returns {string} URL to retrieve image media
 */
export function getPlaceImageUrl(photoName) {
  return `https://places.googleapis.com/v1/${photoName}/media?key=${PLACEHOLDER_API_KEY}&maxHeightPx=400`;
}

/**
 * Get detailed information about landmarks, tourist attractions, hotels, restaurants, or other points of interest.
 * Calls https://places.googleapis.com/v1/places:searchText
 *
 * @param {string} query - Text query searching for a landmark or place (e.g. "Eiffel Tower")
 * @param {number} [maxResults=10] - Maximum number of results to return (1-20)
 * @param {string[]|PlaceField[]} [fields=[]] - Specific fields to include in the response
 * @returns {Promise<Array<object>>} List of place objects matching the query
 */
export async function getAboutPlace(query, maxResults = 10, fields = []) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY not found in environment');
  }

  let fieldMask = 'places.id,places.displayName,places.formattedAddress';
  if (Array.isArray(fields) && fields.length > 0) {
    fieldMask = fields
      .map((f) => {
        if (typeof f === 'string') {
          return PlaceField[f] || f;
        }
        return String(f);
      })
      .filter(Boolean)
      .join(',');
  }

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body = {
    textQuery: query,
    maxResultCount: Number(maxResults || 10),
  };

  const response = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
  });

  const places = Array.isArray(response.data?.places) ? response.data.places : [];

  for (const place of places) {
    if (Array.isArray(place.photos)) {
      place.photos = place.photos.slice(0, 2).map((photo) => ({
        googleMapsUri: photo?.googleMapsUri || null,
        image_url: photo?.name ? getPlaceImageUrl(photo.name) : null,
      }));
    }
  }

  return places;
}

// Snake-case aliases matching Rust functions
export const get_about_place = getAboutPlace;
export const get_place_image_url = getPlaceImageUrl;
