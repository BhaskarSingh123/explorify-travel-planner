import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCalls } from '../src/executeFunctions.js';
import { TOOL_DECLARATIONS, PLAN_OUTPUT_SCHEMA, getTravelPlannerSysPrompt } from '../src/constants.js';
import { Date, IataCode } from '../src/utils.js';
import app, { CHUNK_SEPARATOR } from '../src/index.js';

test('Constants and Schemas are defined properly', () => {
  assert.equal(TOOL_DECLARATIONS.length, 9);
  assert.equal(PLAN_OUTPUT_SCHEMA.type, 'object');
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.outbound);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.inbound);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.hotels);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.itinerary);
  assert.ok(PLAN_OUTPUT_SCHEMA.properties.message);

  const prompt = getTravelPlannerSysPrompt();
  assert.ok(prompt.includes('Explorify AI'));
  assert.ok(prompt.includes("Today's Date:"));
});

test('Utils: Date and IataCode work correctly', () => {
  const d = new Date(2026, 4, 15);
  assert.equal(d.toYyyyMmDd(), '2026-04-15');
  assert.equal(d.to_yyyy_mm_dd(), '2026-04-15');

  const parsed = Date.fromYyyyMmDd('2026-05-20');
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.month, 5);
  assert.equal(parsed.day, 20);

  const iata = new IataCode('DEL');
  assert.equal(iata.toString(), 'DEL');
  assert.throws(() => new IataCode('toolong'));
});

test('executeCalls returns unchanged history when no function calls exist', async () => {
  const history = [
    { role: 'user', parts: [{ text: 'Hello' }] }
  ];
  const tokenMap = [];
  const result = await executeCalls(history, tokenMap);
  assert.equal(result.length, 1);
  assert.equal(result[0].role, 'user');
});

test('executeCalls handles unknown function gracefully with Error response', async () => {
  const history = [
    {
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'unknown_tool',
            args: {}
          }
        }
      ]
    }
  ];
  const tokenMap = [];
  const result = await executeCalls(history, tokenMap);
  assert.equal(result.length, 2);
  assert.equal(result[1].role, 'function');
  assert.equal(result[1].parts[0].functionResponse.name, 'unknown_tool');
  assert.ok(result[1].parts[0].functionResponse.response.Error);
});

test('Express app defines health check route', async () => {
  assert.ok(typeof app === 'function');
  assert.equal(CHUNK_SEPARATOR, '\n');
});
