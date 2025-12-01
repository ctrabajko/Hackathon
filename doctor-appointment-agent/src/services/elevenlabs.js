const axios = require('axios');
const { elevenLabsApiKey } = require('../config/env');

const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Returns { audioBase64, mimeType }
async function synthesizeSpeech(text, voiceId = 'Rachel') {
  if (!elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const url = `${ELEVENLABS_TTS_URL}/${voiceId}`;
  const res = await axios.post(
    url,
    {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.7
      }
    },
    {
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      responseType: 'arraybuffer'
    }
  );

  const audioBuffer = Buffer.from(res.data, 'binary');
  const audioBase64 = audioBuffer.toString('base64');

  return {
    audioBase64,
    mimeType: 'audio/mpeg'
  };
}

module.exports = {
  synthesizeSpeech
};