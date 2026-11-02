import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getTravelPlannerSysPrompt,
  TOOL_DECLARATIONS,
  PLAN_OUTPUT_SCHEMA,
  RETRY_COUNT,
} from './constants.js';
import { executeCalls } from './executeFunctions.js';

/**
 * Checks if an error represents a temporary service unavailability (e.g. 503).
 *
 * @param {any} err
 * @returns {boolean}
 */
function isUnavailableError(err) {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  if (status === 503 || status === 'UNAVAILABLE') return true;
  const msg = (err.message || '').toUpperCase();
  return (
    msg.includes('UNAVAILABLE') ||
    msg.includes('503') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVERLOADED') ||
    msg.includes('FETCH FAILED') ||
    msg.includes('ECONNRESET')
  );
}

/**
 * Retries an asynchronous operation up to maxRetries if it fails with an UNAVAILABLE error.
 *
 * @template T
 * @param {() => Promise<T>} operation
 * @param {number} [maxRetries=RETRY_COUNT]
 * @returns {Promise<T>}
 */
async function sendWithRetry(operation, maxRetries = RETRY_COUNT) {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      if (isUnavailableError(err) && attempt < maxRetries) {
        console.warn(
          `Model not available. ${maxRetries - attempt} retry remaining:\n${err.message || err}`
        );
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Checks if the last message in history has any functionCall parts.
 *
 * @param {Array<{role: string, parts: Array<any>}>} history
 * @returns {boolean}
 */
function lastMessageHasFunctionCalls(history) {
  if (!Array.isArray(history) || history.length === 0) return false;
  const last = history[history.length - 1];
  if (!last || !Array.isArray(last.parts)) return false;
  return last.parts.some((p) => p && (p.functionCall || p.function_call));
}

/**
 * Creates the configured Gemini GenerativeModel instance.
 *
 * @returns {import('@google/generative-ai').GenerativeModel}
 */
export function createGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20',
    systemInstruction: getTravelPlannerSysPrompt(),
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: PLAN_OUTPUT_SCHEMA,
      seed: 1,
    },
  });
}

/**
 * Executes the main AI travel planning loop.
 *
 * Interacts with Gemini using multi-turn function calling:
 * 1. Executes function calls if the last message requested tools
 * 2. Sends user messages or function responses to Gemini
 * 3. Streams back model response chunks via the onChunk callback
 * 4. Repeats until Gemini generates the final travel plan with no further function calls
 * 5. Finally emits the updated tokenMap and returns the complete result
 *
 * @param {Array<{role: string, parts: Array<any>}>} history - The chat session history
 * @param {string[]} tokenMap - Flight booking token map array
 * @param {((chunk: any) => void)} [onChunk] - Callback invoked for each streamed response part
 * @returns {Promise<{history: Array<any>, tokenMap: string[], text: string}>}
 */
export async function planTour(history, tokenMap = [], onChunk) {
  const model = createGeminiModel();
  let chat = null;

  while (true) {
    // 1. If the last message in history contains function calls, execute them first
    if (lastMessageHasFunctionCalls(history)) {
      await executeCalls(history, tokenMap);
      const funcResponseMsg = history[history.length - 1];
      if (typeof onChunk === 'function') {
        onChunk(funcResponseMsg);
      }
    }

    // 2. Prepare message to send and initialize/maintain chat
    const lastChat = history[history.length - 1];
    let streamResult;

    if (!chat) {
      // Initialize chat with prior history, then send the last message
      const priorHistory = history.slice(0, -1);
      chat = model.startChat({ history: priorHistory });

      const partsToSend = lastChat?.parts || (lastChat?.text ? [{ text: lastChat.text }] : []);
      streamResult = await sendWithRetry(() => chat.sendMessageStream(partsToSend));
    } else {
      // Continue existing chat session
      const partsToSend = lastChat?.parts || (lastChat?.text ? [{ text: lastChat.text }] : []);
      streamResult = await sendWithRetry(() => chat.sendMessageStream(partsToSend));
    }

    // 3. Stream chunks to onChunk callback
    for await (const chunk of streamResult.stream) {
      const candidateContent = chunk.candidates?.[0]?.content;
      const chunkData = candidateContent || {
        role: 'model',
        parts: [{ text: typeof chunk.text === 'function' ? chunk.text() : '' }],
      };

      if (typeof onChunk === 'function') {
        onChunk(chunkData);
      }
    }

    // 4. Retrieve complete aggregated response
    const response = await streamResult.response;
    const candidate = response.candidates?.[0]?.content;
    const modelParts = candidate?.parts || [];

    // Append model response to session history
    const lastInHistory = history[history.length - 1];
    if (lastInHistory?.role !== 'model') {
      history.push({
        role: 'model',
        parts: modelParts,
      });
    }

    // 5. Check if the model requested function calls
    const functionCalls = typeof response.functionCalls === 'function' ? response.functionCalls() : [];
    const hasFunctionCalls =
      (functionCalls && functionCalls.length > 0) ||
      modelParts.some((p) => p && (p.functionCall || p.function_call));

    if (!hasFunctionCalls) {
      // No more function calls: send final token_map and finish
      if (typeof onChunk === 'function') {
        onChunk(tokenMap);
      }
      const responseText = typeof response.text === 'function' ? response.text() : '';
      return {
        history,
        tokenMap,
        text: responseText,
      };
    }

    // Has function calls: loop continues, resolving them in the next turn
  }
}

/**
 * Async generator alternative for planTour.
 * Yields each chunk (function responses, model stream chunks, and final tokenMap).
 *
 * @param {Array<{role: string, parts: Array<any>}>} history
 * @param {string[]} tokenMap
 * @returns {AsyncGenerator<any, {history: Array<any>, tokenMap: string[], text: string}, void>}
 */
export async function* planTourStream(history, tokenMap = []) {
  const queue = [];
  let resolveNext = null;
  let finished = false;
  let finalResult = null;
  let streamError = null;

  function pushChunk(chunk) {
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve({ value: chunk, done: false });
    } else {
      queue.push(chunk);
    }
  }

  planTour(history, tokenMap, pushChunk)
    .then((result) => {
      finalResult = result;
      finished = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: undefined, done: true });
      }
    })
    .catch((err) => {
      streamError = err;
      finished = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: undefined, done: true });
      }
    });

  while (true) {
    if (queue.length > 0) {
      yield queue.shift();
    } else if (finished) {
      if (streamError) throw streamError;
      return finalResult;
    } else {
      const next = await new Promise((res) => {
        resolveNext = res;
      });
      if (next.done) {
        if (streamError) throw streamError;
        return finalResult;
      }
      yield next.value;
    }
  }
}

// Snake-case alias matching Rust function plan_tour
export const plan_tour = planTour;
