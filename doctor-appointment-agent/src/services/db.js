const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/appointments.json');

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify([]), 'utf8');
  }
}

function readAppointments() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeAppointments(appointments) {
  fs.writeFileSync(DB_PATH, JSON.stringify(appointments, null, 2), 'utf8');
}

function addAppointment(appointment) {
  const appointments = readAppointments();
  appointments.push(appointment);
  writeAppointments(appointments);
  return appointment;
}

function updateAppointment(id, updates) {
  const appointments = readAppointments();
  const index = appointments.findIndex(a => a.id === id);
  if (index === -1) return null;
  const updated = { ...appointments[index], ...updates, updatedAt: new Date().toISOString() };
  appointments[index] = updated;
  writeAppointments(appointments);
  return updated;
}

function findAppointmentByPhoneAndDate(phoneNumber, dateIso) {
  const appointments = readAppointments();
  return appointments.find(
    a =>
      a.phoneNumber === phoneNumber &&
      a.appointmentDateTime &&
      a.appointmentDateTime.startsWith(dateIso)
  );
}

module.exports = {
  readAppointments,
  addAppointment,
  updateAppointment,
  findAppointmentByPhoneAndDate
};