const client = require('twilio')(process.env.TWILIO_TEST_SID, process.env.TWILIO_TEST_AUTH_TOKEN);

module.exports.send = (body, to = '+15045555555') => {
  return client.messages.create({
    body,
    from: process.env.TWILIO_TEST_PHONE,
    to,
  });
};
