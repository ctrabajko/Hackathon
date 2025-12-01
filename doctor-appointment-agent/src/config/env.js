const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Europe/Berlin',
  doctorName: process.env.DOCTOR_NAME || 'Doctor',
  officeHoursStart: process.env.OFFICE_HOURS_START || '09:00',
  officeHoursEnd: process.env.OFFICE_HOURS_END || '17:00',
  appointmentSlotMinutes: parseInt(process.env.APPOINTMENT_SLOT_MINUTES || '30', 10)
};