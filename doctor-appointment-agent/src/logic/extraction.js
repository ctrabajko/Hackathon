const { v4: uuidv4 } = require('uuid');
const { extractAppointmentDataFromTranscript } = require('../services/llm');
const { defaultTimezone } = require('../config/env');

async function interpretTranscript({ transcript, phoneNumber }) {
  const extraction = await extractAppointmentDataFromTranscript(transcript, phoneNumber);
  const now = new Date().toISOString();

  const baseAppointment = {
    id: uuidv4(),
    patientName: null,
    phoneNumber,
    reason: extraction.reason || '',
    intent: extraction.intent,
    appointmentDateTime: null,
    timezone: defaultTimezone,
    urgencyLevel: extraction.urgencyLevel || 'medium',
    status: 'pending',
    source: 'whatsapp',
    googleCalendarEventId: null,
    createdAt: now,
    updatedAt: now,
    rawTranscript: transcript,
    llmExtraction: extraction,
    meta: {}
  };

  return { extraction, baseAppointment };
}

module.exports = {
  interpretTranscript
};