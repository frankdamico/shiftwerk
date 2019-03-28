const { google } = require('googleapis');
const { oauth2Client } = require('../auth/auth');
const { addWerker } = require('../dbHelpers/dbHelpers');
const { models } = require('../db');

/**
 * given a payload from a google JWT, gets google profile
 *
 * @param {object} user
 * @param {string} type
 * @param {any} client - instance of google.auth.OAuth2
 */
const getGoogleProfile = (user, type, client) => {
  const people = google.people({
    version: 'v1',
    auth: client,
  });
  return people.people.get({
    resourceName: `people/${user.sub}`,
    personFields: 'emailAddresses,names,photos,urls,phoneNumbers',
  })
    .then((googleRes) => {
      console.log(googleRes);
      if (type === 'maker') {
        return {
          access_token: client.credentials.access_token,
          refresh_token: client.credentials.refresh_token,
          name: googleRes.data.names ? googleRes.data.names[0].displayName : '',
          email: googleRes.data.emailAddresses ? googleRes.data.emailAddresses[0].value : '',
          url_photo: googleRes.data.photos ? googleRes.data.photos[0].url : '',
          phone: googleRes.data.phoneNumbers ? googleRes.data.phoneNumbers[0].value : '', // this is a guess!
        };
      }
      return {
        access_token: client.credentials.access_token,
        refresh_token: client.credentials.refresh_token,
        name_first: googleRes.data.names ? googleRes.data.names[0].givenName : '',
        name_last: googleRes.data.names ? googleRes.data.names[0].familyName : '',
        email: googleRes.data.emailAddresses ? googleRes.data.emailAddresses[0].value : '',
        url_photo: googleRes.data.photos ? googleRes.data.photos[0].url : '',
        phone: googleRes.data.phoneNumbers ? googleRes.data.phoneNumbers[0].value : '', // this is a guess!
        bio: '',
        certifications: [],
        positions: [],
      };
    })
    .catch((err) => {
      console.error(err);
    });
};

const saveGoogleProfile = (user, type) => {
  if (type === 'maker') {
    return models.Maker.upsert(user, {
      returning: true,
    }).spread(maker => maker);
  }
  return addWerker(user);
};

const addToCalendar = async (token, client) => {
  const calendar = google.calendar({
    version: 'v3',
    auth: client,
  });
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
  saveGoogleProfile,
};
