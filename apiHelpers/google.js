const { google } = require('googleapis');
const { oauth2Client } = require('../auth/auth');

const people = google.people({
  version: 'v1',
  auth: oauth2Client,
});
const calendar = google.calendar({
  version: 'v3',
  auth: oauth2Client,
});

const getGoogleProfile = (req, res, next) => {
  // oauth2Client.setCredentials({
  //   access_token: req.id,
  //   refresh_token: '',
  // });
  console.log(req.user.google_id);
  return people.people.get({
    resourceName: `people/${req.user.google_id}`,
    personFields: 'emailAddresses,names,photos,urls,phoneNumbers',
  })
    .then((googleRes) => {
      console.log(googleRes);
      if (req.user.type === 'maker') {
        req.user = Object.assign(req.user, {
          name: googleRes.data.names ? googleRes.data.names[0].displayName : '',
          email: googleRes.data.emailAddresses ? googleRes.data.emailAddresses[0].value : '',
          url_photo: googleRes.data.photos ? googleRes.data.photos[0].url : '',
          phone: googleRes.data.phoneNumbers ? googleRes.data.phoneNumbers[0].value : '', // this is a guess!
        });
      } else {
        req.user = Object.assign(req.user, {
          name_first: googleRes.data.names ? googleRes.data.names[0].givenName : '',
          name_last: googleRes.data.names ? googleRes.data.names[0].familyName : '',
          email: googleRes.data.emailAddresses ? googleRes.data.emailAddresses[0].value : '',
          url_photo: googleRes.data.photos ? googleRes.data.photos[0].url : '',
          phone: googleRes.data.phoneNumbers ? googleRes.data.phoneNumbers[0].value : '', // this is a guess!
          bio: '',
          certifications: [],
          positions: [],
        });
      }
      next();
    })
    .catch((err) => {
      console.error(err);
      res.status(403).send('Unauthorized user');
    });
};

const addToCalendar = async (token) => {
  oauth2Client.setCredentials({
    access_token: token.access_token,
  });
  const res = await calendar.events.insert({
    calendarId: 'aeginidae@gmail.com',
    resource: {
      summary: 'hello world',
      location: '6363 St Charles Ave, New Orleans, LA 70115',
      description: 'hello',
      start: {
        dateTime: '2019-03-25T09:00:00-07:00',
        timeZone: 'America/Chicago',
      },
      end: {
        dateTime: '2019-03-25T10:00:00-07:00',
        timeZone: 'America/Chicago',
      },
      attendees: [
        { email: 'aeginidae@gmail.com' },
      ],
    },
  });
  console.log(res.data);
};

const removeFromCalendar = () => {};

module.exports = {
  getGoogleProfile,
  addToCalendar,
  removeFromCalendar,
};
