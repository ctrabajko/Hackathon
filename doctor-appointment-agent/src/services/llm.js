const axios = require('axios');
const { openaiApiKey, doctorName } = require('../config/env');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

async function callChatModel(systemPrompt, userPrompt) {
  const res = await axios.post(
    OPENAI_URL,
    {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    },
    {
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return res.data.choices[0].message.content;
}

async function extractAppointmentDataFromTranscript(transcript, phoneNumber) {
  const systemPrompt = `
You are an AI assistant that extracts scheduling information from patient messages.
You DO NOT provide medical advice. You only handle appointment scheduling.

Return ONLY valid JSON (no markdown) matching this schema:

{
  "intent": "schedule | reschedule | cancel | unknown",
  "preferredDate": "YYYY-MM-DD or null",
  "preferredTime": "HH:MM or null",
  "reason": "string",
  "urgencyLevel": "low | medium | high",
  "confidence": number
}

Rules:
- "intent" is about appointments with ${doctorName}, not medical questions.
- If no clear date/time, use null.
- "urgencyLevel" is based on language: e.g. "as soon as possible", "urgent", "today" -> high; non-urgent -> low.
- If very unsure, set "intent" to "unknown" and "confidence" &lt; 0.5.
- DO NOT include any additional fields or comments.
- Never give medical advice or interpretation.`;

  const userPrompt = `
Patient phone: ${phoneNumber || 'unknown'}
Transcript: "${transcript}"`;

  const raw = await callChatModel(systemPrompt, userPrompt);

  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse LLM extraction JSON');
  }
}

async function proposeSlotsAndMessage(extraction, candidateSlots, timezone) {
  const systemPrompt = `
You are an AI assistant helping schedule appointments for ${doctorName}.
You receive:
- the extracted patient intent as JSON,
- a list of candidate appointment slots from the clinic system.

Your tasks:
1) Choose 1 or 2 of the best slots based on the patient's preferences and urgency.
2) Generate a friendly, professional message for WhatsApp to propose these slots.
3) DO NOT provide medical advice. Only scheduling.

Return ONLY valid JSON matching this schema:

{
  "proposedSlots": [
    {
      "start": "ISO 8601 datetime string in patient's timezone",
      "end": "ISO 8601 datetime string in patient's timezone"
    }
  ],
  "messageText": "string"
}

Guidelines:
- If urgency is high and there is a near-term slot, prioritize the earliest.
- Respect any date/time preferences if possible.
- If no slots match exactly, choose the closest alternatives and explain briefly.
- Tone: warm, concise, scheduling-only.`;

  const userPrompt = `
Patient extraction JSON:
${JSON.stringify(extraction, null, 2)}

Candidate slots (ISO 8601, timezone ${timezone}):
${JSON.stringify(candidateSlots, null, 2)}`;

  const raw = await callChatModel(systemPrompt, userPrompt);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  return parsed;
}

async function craftConfirmationMessage(appointment) {
  const systemPrompt = `
You are an AI assistant confirming appointments for ${doctorName}.
You only talk about scheduling, never give medical advice.

Return a short WhatsApp-friendly confirmation message.
No JSON, just plain text.
Avoid clinical language; focus on date, time, and location.`;

  const userPrompt = `
Appointment details (JSON):
${JSON.stringify(appointment, null, 2)}`;

  const text = await callChatModel(systemPrompt, userPrompt);
  return text.trim();
}

module.exports = {
  extractAppointmentDataFromTranscript,
  proposeSlotsAndMessage,
  craftConfirmationMessage
};