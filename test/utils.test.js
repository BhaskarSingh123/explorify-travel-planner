import test from 'node:test';
import assert from 'node:assert/strict';
import { Date as CustomDate, IataCode } from '../src/utils.js';
import {
  RETRY_COUNT,
  getTravelPlannerSysPrompt,
  PLAN_OUTPUT_SCHEMA,
  TOOL_DECLARATIONS,
} from '../src/constants.js';

test('Date class basic instantiation and validation', () => {
  const date = new CustomDate(2026, 10, 30);
  assert.equal(date.year, 2026);
  assert.equal(date.month, 10);
  assert.equal(date.day, 30);
  assert.equal(date.toYyyyMmDd(), '2026-10-30');

  assert.throws(() => new CustomDate(2026, 10, 32), /Day cannot be more than 31\. Found: 32/);
  assert.throws(() => new CustomDate(2026, 13, 10), /Month cannot be more than 12\. Found: 13/);
});

test('Date.fromYyyyMmDd parsing', () => {
  const date = CustomDate.fromYyyyMmDd('2026-05-09');
  assert.equal(date.year, 2026);
  assert.equal(date.month, 5);
  assert.equal(date.day, 9);
  assert.equal(date.toYyyyMmDd(), '2026-05-09');

  assert.throws(() => CustomDate.fromYyyyMmDd('2026-05-09-01'), /Too many parameters in data/);
  assert.throws(() => CustomDate.fromYyyyMmDd('2026-05'), /Invalid date format/);
});

test('Date.now() and newNow()', () => {
  const nowStr = CustomDate.now();
  assert.ok(typeof nowStr === 'string' && nowStr.includes('IST'));

  const newNowDate = CustomDate.newNow();
  assert.ok(newNowDate instanceof CustomDate);
  assert.ok(newNowDate.year >= 2024);
  assert.ok(newNowDate.month >= 1 && newNowDate.month <= 12);
  assert.ok(newNowDate.day >= 1 && newNowDate.day <= 31);
});

test('IataCode validation', () => {
  const del = new IataCode('DEL');
  assert.equal(del.toString(), 'DEL');
  assert.equal(del.code, 'DEL');

  const bom = IataCode.new('BOM');
  assert.equal(bom.toString(), 'BOM');

  assert.throws(() => new IataCode('del'), /Invalid IATA code: del/);
  assert.throws(() => new IataCode('DELHI'), /Invalid IATA code: DELHI/);
  assert.throws(() => new IataCode('D12'), /Invalid IATA code: D12/);
});

test('Constants export checks', () => {
  assert.equal(RETRY_COUNT, 3);

  const prompt = getTravelPlannerSysPrompt();
  assert.ok(prompt.includes('You are Explorify AI'));
  assert.ok(prompt.includes("Today's Date:"));
  assert.ok(prompt.includes('https://www.irctc.co.in/nget/booking/train-list'));

  assert.equal(PLAN_OUTPUT_SCHEMA.type, 'object');
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.outbound);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.inbound);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.hotels);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.itinerary);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.message);
  assert.deepEqual(PLAN_OUTPUT_SCHEMA.required, ['outbound', 'inbound', 'message']);

  assert.equal(TOOL_DECLARATIONS.length, 9);
  const toolNames = TOOL_DECLARATIONS.map((t) => t.name);
  assert.deepEqual(toolNames, [
    'flights_between',
    'flight_booking_details',
    'flight_booking_link',
    'trains_between',
    'train_seats_available',
    'get_about_place',
    'get_hotel_by_coordinates',
    'get_hotel_details',
    'get_room_availability',
  ]);
});
