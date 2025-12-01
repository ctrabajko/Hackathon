const { proposeSlotsAndMessage } = require('../services/llm');

async function chooseSlotsAndBuildMessage(extraction, candidateSlots, timezone) {
  if (!candidateSlots || candidateSlots.length === 0) {
    return {
      proposedSlots: [],
      messageText:
        "I'm sorry, I couldn't find any available appointment slots that match your preferences. Could you suggest alternative dates or times?"
    };
  }

  const result = await proposeSlotsAndMessage(extraction, candidateSlots, timezone);
  return result;
}

module.exports = {
  chooseSlotsAndBuildMessage
};