export const MAX_CHARS = 12000;
export const MIN_CHARS = 40;

export const LANGUAGES = {
  en: "English",
  as: "Assamese (Assamese script)",
  bn: "Bengali (Bengali script)",
  gu: "Gujarati (Gujarati script)",
  hi: "Hindi (Devanagari script)",
  kn: "Kannada (Kannada script)",
  ml: "Malayalam (Malayalam script)",
  mr: "Marathi (Devanagari script)",
  or: "Odia (Odia script)",
  ta: "Tamil (Tamil script)",
  te: "Telugu (Telugu script)"
};

export function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanList(value, limit, max) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clean(item, max)).filter(Boolean).slice(0, limit);
}

export function pickLanguage(code) {
  const key = Object.prototype.hasOwnProperty.call(LANGUAGES, code) ? code : "en";
  return { code: key, name: LANGUAGES[key] };
}

export function languageLine(language) {
  return language.code === "en"
    ? `Output language: ${language.name}`
    : `Output language: ${language.name}. Write in the native script of this language, not in Latin letters.`;
}

export function levelRule(level) {
  return level === "standard"
    ? "Reading level: standard. Clear language for an adult with no medical training."
    : "Reading level: very simple. Short sentences, everyday words, about grade 6 reading level.";
}

export function checkText(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < MIN_CHARS) {
    return { error: `The ${label} is too short to explain. Paste more of it.` };
  }
  if (text.length > MAX_CHARS) {
    return { error: `The ${label} is too long. Paste up to 12,000 characters.` };
  }
  return { text };
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

async function attempt(env, model, request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: request,
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn("Gemini returned status " + response.status + " for model " + model);
      return {
        retry: [429, 500, 502, 503, 504].includes(response.status),
        status: response.status,
        retryAfter: Number(response.headers.get("retry-after")) || 0
      };
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      return { retry: true, status: 502 };
    }

    if (payload.promptFeedback && payload.promptFeedback.blockReason) {
      return { fatal: { error: "This text could not be processed.", status: 422 } };
    }

    const candidate = payload.candidates && payload.candidates[0];
    if (candidate && candidate.finishReason === "SAFETY") {
      return { fatal: { error: "This text could not be processed.", status: 422 } };
    }

    const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    if (!part || typeof part.text !== "string") return { retry: true, status: 502 };

    try {
      return { data: JSON.parse(part.text) };
    } catch (error) {
      return { retry: true, status: 502 };
    }
  } catch (error) {
    return { retry: true, status: controller.signal.aborted ? 504 : 502 };
  } finally {
    clearTimeout(timer);
  }
}

function describeFailure(last) {
  if (last.status === 429) return { error: "Too many requests right now. Wait a minute and try again.", status: 429 };
  if (last.status === 504) return { error: "The explanation service took too long. Try again.", status: 504 };
  if (last.status === 500 || last.status === 503) return { error: "The explanation service is busy. Try again in a moment.", status: 503 };
  if ([400, 401, 403, 404].includes(last.status)) return { error: "The service is not configured correctly.", status: 500 };
  return { error: "The explanation could not be produced. Try again.", status: 502 };
}

export async function generate({ env, system, prompt, schema }) {
  if (!env.GEMINI_API_KEY) {
    return { error: "The service is not configured.", status: 500 };
  }

  const request = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const timeoutMs = number(env.GEMINI_TIMEOUT_MS, 28000);
  const deadlineMs = number(env.GEMINI_DEADLINE_MS, 58000);
  const baseDelay = number(env.GEMINI_RETRY_DELAY_MS, 700);
  const primary = env.GEMINI_MODEL || "gemini-2.5-flash";
  const models = [primary];
  if (env.GEMINI_FALLBACK_MODEL && env.GEMINI_FALLBACK_MODEL !== primary) models.push(env.GEMINI_FALLBACK_MODEL);

  const started = Date.now();
  let last = { status: 502 };

  for (let index = 0; index < models.length; index += 1) {
    const tries = index === 0 ? 3 : 2;
    for (let count = 0; count < tries; count += 1) {
      const remaining = deadlineMs - (Date.now() - started);
      if (remaining < 1500 && Date.now() - started > 0) break;

      const result = await attempt(env, models[index], request, Math.max(1, Math.min(timeoutMs, remaining)));
      if (result.data !== undefined) return { data: result.data };
      if (result.fatal) return result.fatal;

      last = result;
      if (!result.retry) break;

      const delay = result.status === 429 ? Math.min(Math.max(result.retryAfter * 1000, baseDelay * 3), 5000) : baseDelay * (count + 1);
      await sleep(delay);
    }
  }

  return describeFailure(last);
}
