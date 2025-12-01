# AI-Powered Doctor Office Appointment Automation
### Hackathon Architecture & Demo Deck

This Markdown file is structured so you can present directly from it or export it as a PDF (e.g., via VS Code, Obsidian, or `pandoc`).

---

## Slide 1 – Problem

- Doctor offices spend a lot of time:
  - Answering phone calls
  - Manually checking calendars
  - Going back-and-forth to find appointment times
- Patients:
  - Want quick, simple booking from their phones
  - Often prefer voice over typing
- Most clinics still have:
  - No automation
  - No 24/7 scheduling

**Goal:** Automate appointment scheduling using WhatsApp + voice + AI, without touching medical advice.

---

## Slide 2 – Solution Overview

We built an AI-powered agent that:

- Listens to WhatsApp voice notes from patients
- Understands their intent and desired time
- Checks the doctor’s Google Calendar
- Proposes 1–2 appointment slots
- Confirms via WhatsApp text + voice (ElevenLabs)
- Logs all appointments in a lightweight database and simple dashboard

**Focus:** Scheduling only. No diagnosis, no prescriptions.

---

## Slide 3 – High-Level Architecture

Text diagram:

- Patient (WhatsApp)
  - sends voice note
    ↓
- Twilio WhatsApp
  - receives inbound message
  - calls n8n webhook
    ↓
- n8n Orchestrator
  - downloads audio from Twilio
  - sends audio to OpenAI Whisper (STT)
  - calls Backend for LLM reasoning
  - calls Google Calendar for availability
  - calls Backend for TTS (ElevenLabs)
  - sends WhatsApp text + voice via Twilio
  - on confirmation, writes to Google Calendar
  - logs appointment via Backend
    ↓
- Backend (Node.js)
  - LLM prompting and JSON extraction
  - Slot selection helper
  - ElevenLabs integration
  - Appointment logging (JSON file / DB)
  - Minimal doctor dashboard

---

## Slide 4 – Core Components

1. **WhatsApp Interface (Twilio)**
   - Receives and sends WhatsApp messages (voice + text)
   - Provides media URLs for recorded voice notes

2. **n8n Automation**
   - Central workflow engine
   - Wires together Twilio, OpenAI Whisper, Backend, Google Calendar, ElevenLabs
   - Handles branches: schedule / reschedule / cancel / unknown

3. **Backend (Node.js + Express)**
   - `/api/interpret-intent`: LLM call to extract structured appointment data
   - `/api/propose-slots`: LLM call to select best slots and craft user message
   - `/api/tts`: ElevenLabs TTS for natural-sounding replies
   - `/api/appointments`: JSON-based storage for appointments
   - `/api/appointments (GET)`: data for the doctor dashboard

4. **Google Calendar**
   - Source of truth for doctor availability
   - n8n lists events and creates bookings

5. **Doctor Dashboard (HTML/JS)**
   - Lists confirmed appointments from the backend
   - Simple for demo; can be extended to a full UI

---

## Slide 5 – Data Flow (End to End)

1. Patient sends WhatsApp voice message.
2. Twilio webhook → n8n:
   - n8n receives metadata + `MediaUrl0`.
3. n8n downloads audio from Twilio.
4. n8n sends audio to OpenAI Whisper STT:
   - Receives transcript text.
5. n8n sends transcript + phone to Backend `/api/interpret-intent`:
   - LLM returns:
     - `intent` (schedule / reschedule / cancel / unknown)
     - `preferredDate`, `preferredTime`
     - `reason`, `urgencyLevel`
     - `confidence`
     - `baseAppointment` object ready to be stored later.
6. n8n checks Google Calendar availability:
   - Lists events in a given window (e.g. next 7 days).
   - Builds candidate free slots respecting office hours and slot length.
7. n8n calls Backend `/api/propose-slots`:
   - Sends `extraction` + `candidateSlots`.
   - LLM chooses 1–2 best slots and returns `messageText`.
8. n8n calls Backend `/api/tts`:
   - ElevenLabs returns base64 MP3 audio for the message.
9. n8n sends WhatsApp reply via Twilio:
   - Text: proposed appointment times.
   - Voice note: same message spoken via ElevenLabs.
10. Patient replies (text):
    - “Yes, 9am works.”
11. n8n interprets confirmation:
    - Creates event in Google Calendar.
    - Calls `/api/appointments` with:
      - `baseAppointment`
      - `chosenSlot`
      - `googleCalendarEventId`
12. Backend logs appointment and returns a confirmation text.
13. n8n calls `/api/tts` again for confirmation audio.
14. n8n sends final confirmation (text + voice) to the patient.
15. Doctor opens dashboard to see upcoming appointments.

---

## Slide 6 – LLM Responsibilities

We keep the LLM focused on scheduling only:

1. **Intent + Extraction**
   - Input: transcript + phone number
   - Output JSON:
     - `intent`
     - `preferredDate`
     - `preferredTime`
     - `reason`
     - `urgencyLevel`
     - `confidence`
   - Constraints:
     - No diagnosis or medical advice
     - Only interpret scheduling needs

2. **Slot Selection + Message Crafting**
   - Input: extraction JSON + candidate time slots
   - Output JSON:
     - `proposedSlots` (1–2 entries)
     - `messageText` (WhatsApp-friendly)
   - Behavior:
     - Honors urgency (earlier times for high urgency)
     - Respects patient preferences where possible
     - Explains if only approximate matches are available

3. **Confirmation Message**
   - Input: final appointment details
   - Output: short plain-text confirmation message

---

## Slide 7 – Error Handling & Edge Cases

- **Ambiguous / Unknown Intent**
  - LLM returns `intent = "unknown"` and low `confidence`
  - n8n sends a clarification message:
    - “I’m not sure when you’d like to come in. Could you please specify a date or time range?”

- **No Available Slots**
  - n8n detects zero candidate slots in the requested range
  - Backend returns a polite fallback message asking for alternative times

- **Conflicting Bookings**
  - Handled at the Google Calendar layer:
    - Events are created only in free time slots
  - Dashboard shows current confirmed appointments for manual verification

- **Service Failures (STT, LLM, TTS)**
  - n8n workflow error handling:
    - Logs errors
    - Sends a generic “We’re experiencing technical issues” message if needed

---

## Slide 8 – Security & Privacy (MVP Level)

- Captured data is limited to:
  - Patient name (if mentioned)
  - Phone number
  - Appointment time
  - Short free-text reason (e.g. “checkup”, “follow-up visit”)
- No diagnosis, lab results, or sensitive clinical notes
- Data at rest:
  - Stored in a simple JSON file for demo
  - Can be mapped to Firestore or other DB in production
- Data in transit:
  - Uses HTTPS for API calls (OpenAI, ElevenLabs, Twilio, Google Calendar)
- Next steps for production:
  - Authentication on dashboard
  - Encrypted storage
  - Role-based access control
  - Formal DPA/BAA depending on region

---

## Slide 9 – Demo Walkthrough

1. Show architecture diagram (this deck).
2. Open WhatsApp on a phone:
   - Send a voice note:
     - “Hi, I’d like to see Dr. Smith next Tuesday morning around 9 or 10 for a quick checkup.”
3. In n8n:
   - Show the live workflow run:
     - Webhook → Download audio → Whisper STT → Interpret Intent → Google Calendar → Propose Slots → TTS → Twilio Reply.
4. Show WhatsApp:
   - Patient receives:
     - Text with 1–2 proposed times.
     - Voice note with the same message.
5. Reply: “9am works.”
6. In n8n:
   - Show the confirmation branch firing.
   - Google Calendar event is created.
7. Show:
   - Google Calendar with the new appointment.
   - Minimal doctor dashboard listing the confirmed appointment.

---

## Slide 10 – Implementation Summary

- **Backend**
  - Node.js + Express
  - Clearly separated modules:
    - `services/` for LLM, TTS, DB
    - `logic/` for interpretation and scheduling
    - `routes/` for HTTP endpoints
    - `public/` for dashboard

- **Orchestration**
  - n8n:
    - Webhook + Function nodes
    - HTTP Request nodes for APIs
    - Google Calendar node
    - Twilio HTTP calls for WhatsApp messages

- **Third-Party Services**
  - OpenAI (Whisper + GPT)
  - ElevenLabs (TTS)
  - Twilio (WhatsApp)
  - Google Calendar (availability + bookings)

---

## Slide 11 – Roadmap

- Replace JSON file with Firestore or relational DB.
- Add authentication and richer UI for the doctor dashboard.
- Add appointment reminders and follow-up notifications.
- Support multiple doctors and clinics.
- Improve natural language understanding:
  - Multi-language support
  - More robust rescheduling and cancellation flows.
- Integrate with EHR systems (without storing clinical data in this service).

---

## Slide 12 – Key Takeaways

- Voice-first, WhatsApp-native scheduling experience.
- LLM used strictly for:
  - Interpreting requests
  - Selecting time slots
  - Drafting friendly messages
- n8n orchestrates all integrations:
  - Twilio, OpenAI, ElevenLabs, Google Calendar, Backend
- MVP is realistic to build in 24–48 hours and highly demoable.

---

### How to Export to PDF

You can create a PDF of these slides using any of the following:

- VS Code + Markdown preview → Print to PDF
- Obsidian / Typora → Export as PDF
- `pandoc` from the project root:

```bash
cd doctor-appointment-agent
pandoc docs/architecture_presentation.md -o docs/architecture_presentation.pdf
```

Use the resulting `architecture_presentation.pdf` as your hackathon presentation deck.