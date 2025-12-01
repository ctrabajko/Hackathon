const express = require('express');
const { interpretTranscript } = require('../logic/extraction');
const { chooseSlotsAndBuildMessage } = require('../logic/scheduling');
const { synthesizeSpeech } = require('../services/elevenlabs');
const {
  addAppointment,
  readAppointments,
  updateAppointment
} = require('../services/db');
const { craftConfirmationMessage } = require('../services/llm');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Interpret intent from transcript (called by n8n)
router.post('/interpret-intent', async (req, res) => {
  try {
    const { transcript, phoneNumber } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'transcript is required' });
    }

    const { extraction, baseAppointment } = await interpretTranscript({
      transcript,
      phoneNumber: phoneNumber || null
    });

    res.json({ extraction, baseAppointment });
  } catch (err) {
    console.error('interpret-intent error', err);
    res.status(500).json({ error: 'Failed to interpret intent' });
  }
});

// Propose slots and message (called by n8n after GCal availability)
router.post('/propose-slots', async (req, res) => {
  try {
    const { extraction, candidateSlots, timezone } = req.body;
    if (!extraction || !candidateSlots) {
      return res.status(400).json({ error: 'extraction and candidateSlots are required' });
    }

    const result = await chooseSlotsAndBuildMessage(
      extraction,
      candidateSlots,
      timezone || extraction.timezone
    );

    res.json(result);
  } catch (err) {
    console.error('propose-slots error', err);
    res.status(500).json({ error: 'Failed to propose slots' });
  }
});

// Create appointment record (called after GCal event created)
router.post('/appointments', async (req, res) => {
  try {
    const { baseAppointment, chosenSlot, googleCalendarEventId } = req.body;
    if (!baseAppointment || !chosenSlot) {
      return res.status(400).json({ error: 'baseAppointment and chosenSlot are required' });
    }

    const appointment = {
      ...baseAppointment,
      appointmentDateTime: chosenSlot.start,
      status: 'confirmed',
      googleCalendarEventId: googleCalendarEventId || null,
      updatedAt: new Date().toISOString()
    };

    const stored = addAppointment(appointment);

    const confirmationMessage = await craftConfirmationMessage(stored);

    res.json({ appointment: stored, confirmationMessage });
  } catch (err) {
    console.error('appointments create error', err);
    res.status(500).json({ error: 'Failed to save appointment' });
  }
});

// Update appointment status (cancel/reschedule)
router.patch('/appointments/:id', async (req, res) => {
  try {
    const updated = updateAppointment(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json({ appointment: updated });
  } catch (err) {
    console.error('appointments update error', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// List appointments for dashboard
router.get('/appointments', (req, res) => {
  try {
    const appointments = readAppointments();
    res.json({ appointments });
  } catch (err) {
    console.error('appointments list error', err);
    res.status(500).json({ error: 'Failed to list appointments' });
  }
});

// ElevenLabs TTS
router.post('/tts', async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const { audioBase64, mimeType } = await synthesizeSpeech(text, voiceId);
    res.json({ audioBase64, mimeType });
  } catch (err) {
    console.error('tts error', err);
    res.status(500).json({ error: 'Failed to synthesize speech' });
  }
});

module.exports = router;