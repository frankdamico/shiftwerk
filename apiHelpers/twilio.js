const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const service = client.notify.services(process.env.TWILIO_NOTIFY_SERVICE_SID);

module.exports.send = (body, to = '+15045555555') => {
  return client.messages.create({
    body,
    from: process.env.TWILIO_TEST_PHONE,
    to,
  });
};

module.exports.massText = (body, numbers) => {
  const bindings = numbers.map(number => JSON.stringify({ binding_type: 'sms', address: number }));
  return service.notifications.create({
    toBinding: bindings,
    body,
  })
    .catch(err => console.error(err));
};
