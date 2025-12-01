# AI-Powered Doctor Office Appointment Automation (MVP)

This project is an MVP for automating doctor appointment scheduling via WhatsApp voice messages, powered by n8n, OpenAI, ElevenLabs, and Google Calendar.

It is designed for a 24–48 hour hackathon build and includes:

- Backend (Node.js + Express)
- n8n integration points
- WhatsApp (Twilio Sandbox) integration guide
- Google Calendar integration (via n8n)
- ElevenLabs text-to-speech integration
- LLM prompting for intent extraction and slot selection
- Minimal doctor dashboard
- Architecture presentation (Markdown, ready for PDF export)
- A helper script to create a .zip of the project

---

## 1. Project Structure

```text
doctor-appointment-agent/
  ├─ package.json
  ├─ .env.example
  ├─ .gitignore
  ├─ README.md
  ├─ data/
  │   └─ appointments.json
  ├─ src/
  │   ├─ server.js
  │   ├─ config/
  │   │   └─ env.js
  │   ├─ services/
  │   │   ├─ llm.js
  │   │   ├─ elevenlabs.js
  │   │   └─ db.js
  │   ├─ logic/
  │   │   ├─ extraction.js
  │   │   └─ scheduling.js
  │   └─ routes/
  │       └─ api.js
  ├─ public/
  │   └─ dashboard.html
  ├─ docs/
  │   ├─ architecture_presentation.md
  │   └─ n8n_workflow_example.json
  └─ scripts/
      └─ create-zip.sh
```

---

## 2. Prerequisites

- Node.js 18+ and npm
- n8n instance (local or cloud)
- Twilio account with WhatsApp Sandbox enabled
- Google account with Calendar access for the doctor
- OpenAI API key (for GPT and Whisper)
- ElevenLabs API key

---

## 3. Backend Setup

### 3.1 Install dependencies

```bash
cd doctor-appointment-agent
npm install
```

### 3.2 Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with your values:

- `OPENAI_API_KEY`: OpenAI API key (for GPT-4o and Whisper).
- `ELEVENLABS_API_KEY`: ElevenLabs API key.
- `DEFAULT_TIMEZONE`: Timezone like `Europe/Berlin`.
- `DOCTOR_NAME`: e.g. `Dr. Smith`.
- `OFFICE_HOURS_START` / `OFFICE_HOURS_END`: e.g. `09:00` and `17:00`.
- `APPOINTMENT_SLOT_MINUTES`: e.g. `30`.
- `PORT`: backend port, default `3000`.

### 3.3 Start the backend

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Backend endpoints:

- API base: `http://localhost:3000/api`
  - `GET /health` – health check
  - `POST /interpret-intent` – interpret WhatsApp transcript with LLM
  - `POST /propose-slots` – choose best slots and craft message text
  - `POST /tts` – ElevenLabs TTS, returns base64 MP3
  - `POST /appointments` – log a confirmed appointment
  - `PATCH /appointments/:id` – update an appointment (e.g., cancel)
  - `GET /appointments` – list all logged appointments
- Dashboard: `http://localhost:3000/` – minimal doctor dashboard

---

## 4. Data Model

Appointments are stored in `data/appointments.json` as an array of objects:

```json
{
  "id": "string-uuid",
  "patientName": "string or null",
  "phoneNumber": "string",
  "reason": "string",
  "intent": "schedule | reschedule | cancel",
  "appointmentDateTime": "ISO 8601 datetime",
  "timezone": "Europe/Berlin",
  "urgencyLevel": "low | medium | high",
  "status": "pending | confirmed | cancelled | rescheduled",
  "source": "whatsapp",
  "googleCalendarEventId": "string or null",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "rawTranscript": "string",
  "llmExtraction": {
    "intent": "schedule | reschedule | cancel | unknown",
    "preferredDate": "YYYY-MM-DD or null",
    "preferredTime": "HH:MM or null",
    "reason": "string",
    "urgencyLevel": "low | medium | high",
    "confidence": 0
  },
  "meta": {
    "twilioSid": "string or null",
    "notes": "string or null"
  }
}
```

For the MVP this is a simple JSON file. It can be replaced with Firestore or another DB later.

---

## 5. LLM Integration

The backend uses OpenAI via `src/services/llm.js` for:

1. Intent extraction and JSON structuring:
   - Endpoint: `POST /api/interpret-intent`
   - Input: `{ transcript, phoneNumber }`
   - Output: `{ extraction, baseAppointment }`
   - Schema for `extraction`:

     ```json
     {
       "intent": "schedule | reschedule | cancel | unknown",
       "preferredDate": "YYYY-MM-DD or null",
       "preferredTime": "HH:MM or null",
       "reason": "string",
       "urgencyLevel": "low | medium | high",
       "confidence": 0
     }
     ```

2. Slot selection and outbound message text:
   - Endpoint: `POST /api/propose-slots`
   - Input: `{ extraction, candidateSlots, timezone }`
   - Output:

     ```json
     {
       "proposedSlots": [
         { "start": "ISO string", "end": "ISO string" }
       ],
       "messageText": "string"
     }
     ```

3. Confirmation message generation:
   - Used internally in `POST /api/appointments` to generate a human-friendly confirmation text.

Prompts are defined directly in `src/services/llm.js` and keep the agent focused only on scheduling (no medical advice).

---

## 6. ElevenLabs Integration

- Endpoint: `POST /api/tts`
- Body:

  ```json
  {
    "text": "Message to synthesize",
    "voiceId": "Rachel"
  }
  ```

- Response:

  ```json
  {
    "audioBase64": "base64-encoded-mp3",
    "mimeType": "audio/mpeg"
  }
  ```

Use this from n8n:

1. Call `/api/tts` with the message text produced by `/api/propose-slots` or the confirmation message.
2. Convert the base64 audio to binary/host it somewhere accessible (e.g. via a simple backend endpoint or file storage).
3. Send a WhatsApp voice note by passing the media URL to Twilio.

---

## 7. n8n Workflow Setup

An example workflow structure is provided in `docs/n8n_workflow_example.json`. You can import it into n8n and wire credentials.

High-level steps:

1. Webhook node (`/webhook/twilio-whatsapp`) receives Twilio POST from WhatsApp voice.
2. Function node parses:
   - `From`
   - `MediaUrl0`
   - `MediaContentType0`
3. HTTP node downloads audio from Twilio (binary).
4. HTTP node calls OpenAI Whisper STT.
5. HTTP node calls backend `/api/interpret-intent`.
6. IF node branches on `intent`:
   - `schedule` / `reschedule`: proceed to availability and slot selection.
   - `cancel`: run cancellation logic.
   - `unknown`: send clarification message.
7. For schedule/reschedule:
   - Google Calendar node lists existing events in a date range.
   - Function node builds candidate slots (respecting office hours and existing events).
   - HTTP node calls `/api/propose-slots`.
   - HTTP node calls `/api/tts` to synthesize the response.
   - HTTP node (Twilio) sends WhatsApp text + voice note to the patient.
8. Wait for patient confirmation (text).
   - On “yes”:
     - Google Calendar node creates an event.
     - HTTP node calls `/api/appointments` to log it.
     - HTTP node calls `/api/tts` for confirmation message.
     - HTTP node (Twilio) sends confirmation text + voice.
   - On “no” or reschedule request:
     - Loop back to slot selection.

You can adjust details in the n8n UI after import.

---

## 8. WhatsApp Integration (Twilio Sandbox)

1. Create a Twilio account.
2. Enable the WhatsApp Sandbox in Twilio Console.
3. Configure **WHEN A MESSAGE COMES IN** for the sandbox to point to your n8n Webhook URL, e.g.:

   ```text
   https://&lt;your-n8n-host&gt;/webhook/twilio-whatsapp
   ```

4. From your phone, join the sandbox using the Twilio-provided code (send a keyword).
5. Send a voice note to the sandbox number. Twilio will:
   - POST form-encoded data to n8n webhook, including:
     - `From`
     - `Body`
     - `MediaUrl0`
     - `MediaContentType0`

For replies (outgoing messages), use Twilio’s Messages API from n8n:

- `To`: patient’s WhatsApp number
- `From`: Twilio WhatsApp sandbox number
- `Body`: text message
- `MediaUrl`: URL of the ElevenLabs audio file (for voice note)

---

## 9. Google Calendar Integration (via n8n)

1. In n8n, configure Google OAuth credentials.
2. Add a Google Calendar node:
   - For availability: use **List Events** with:
     - `calendarId`: doctor’s calendar
     - `timeMin`: now or extracted preferred date
     - `timeMax`: a configurable horizon (e.g. +7 days)
3. Build candidate slots in a Function node based on:
   - Office hours (from `.env`)
   - Slot length (e.g. 30 minutes)
   - Existing events returned by Google Calendar.
4. After patient confirmation, use **Create Event** to book the appointment in Google Calendar.

---

## 10. Doctor Dashboard

The dashboard is a simple static page served by the backend:

- URL: `http://localhost:3000/`
- It calls `GET /api/appointments` and renders:
  - Patient name (if known)
  - Phone number
  - Date/time
  - Reason
  - Urgency
  - Status

This is primarily for demo purposes and can be styled or extended as needed.

---

## 11. Architecture Presentation (PDF-Ready)

The file `docs/architecture_presentation.md` contains a slide-style walkthrough of:

- Problem statement
- Solution overview
- High-level architecture diagram (text)
- Component breakdown
- End-to-end flow
- Demo story

You can open this Markdown file in your editor or markdown-to-PDF tool and export it as a PDF to use in your hackathon presentation.

---

## 12. Creating a .zip of the Project

A helper script is included at `scripts/create-zip.sh`.

From the project root:

```bash
chmod +x scripts/create-zip.sh
./scripts/create-zip.sh
```

This will create `doctor-appointment-agent.zip` containing:

- All source code
- Configuration templates
- Docs (including architecture presentation and n8n workflow example)
- Scripts

You can use that .zip as your deliverable or to move the project quickly between machines.

---

## 13. Demo Script (Quick Reference)

1. Start backend and n8n.
2. Show the architecture slide from `docs/architecture_presentation.md` (or exported PDF).
3. From your phone, send a WhatsApp voice note:
   - “Hi, I’d like to book an appointment with Dr. Smith next Tuesday morning around 9 or 10.”
4. Show n8n workflow execution:
   - Webhook → Whisper STT → `/interpret-intent` → Google Calendar → `/propose-slots` → `/tts` → Twilio reply.
5. Show WhatsApp:
   - Patient receives text + voice proposing 1–2 slots.
6. Reply “9am works.”
   - n8n creates event in Google Calendar.
   - Backend logs appointment.
7. Show:
   - Google Calendar event.
   - Doctor dashboard listing the appointment.

This completes the end-to-end demo of the AI-powered appointment scheduling agent.
