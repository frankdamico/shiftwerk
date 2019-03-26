/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const dbHelpers = require('../dbHelpers/dbHelpers.js');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);
const people = google.people({
  version: 'v1',
  auth: oauth2Client,
});
const calendar = google.calendar({
  version: 'v3',
  auth: oauth2Client,
});
const { geocode, reverseGeocode } = require('../apiHelpers/tomtom');
const { models } = require('../db/index');
const twilio = require('../apiHelpers/twilio');


const app = express();
app.use(bodyParser.json());
app.use(cors());

const getProfile = (idToken) => {
  oauth2Client.setCredentials({
    access_token: idToken.access_token,
    refresh_token: '',
  });
  return people.people.get({
    resourceName: 'people/me',
    personFields: 'emailAddresses,names,photos,urls,phoneNumbers',
  })
    .then(res => res.data)
    .catch(err => err);
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

const errorHandler = (err, res) => {
  console.error(err);
  res.send(500, 'Something went wrong!');
};

app.put('/text', (req, res) => {
  const { body, to } = req.body;
  twilio.send(body, to)
    .then((message) => {
      res.json(201, message.sid);
    })
    .catch(err => errorHandler(err, res));
});

// ----WERKER---- ////

// get profile for werker
app.get('/werkers/:werkerId', (req, res) => {
  return dbHelpers.getWerkerProfile(req.params.werkerId)
    .then((profile) => {
      console.log(profile);
      if (profile.dataValues.lat) {
        return reverseGeocode(profile.dataValues.lat, profile.dataValues.long)
          .then(address => Object.assign(profile, {
            dataValues: Object.assign(profile.dataValues, {
              address,
            }),
          }));
      }
      return new Promise(resolve => resolve(profile));
    })
    .then(profile => res.json(200, profile))
    .catch((err) => {
      console.error(err);
      res.send(500, 'something went wrong!');
    });
});

// get werkers by position
app.get('/werkers/search/:positionName', (req, res) => {
  dbHelpers.getWerkersByPosition(req.params.positionName)
    .then(werkers => res.json(200, werkers))
    .catch((err) => {
      console.error(err);
      res.send(500, 'something went wrong!');
    });
});

/**
 * PUT /werkers
 * expects JWT as body
 * creates new resource in db
 * sends back new db record
 */

app.put('/werkers', (req, res) => {
  console.log(req.body);
  const newJWT = req.body;
  // oauth2Client.credentials = newJWT;
  return getProfile(newJWT)
    .then((profile) => {
      console.log(profile);
      const newWerker = {
        name_first: profile.names ? profile.names[0].givenName : '',
        name_last: profile.names ? profile.names[0].familyName : '',
        email: profile.emailAddresses ? profile.emailAddresses[0].value : '',
        url_photo: profile.photos ? profile.photos[0].url : '',
        phone: profile.phoneNumbers ? profile.phoneNumbers[0].value : '', // this is a guess!
        bio: '',
        address: '',
        certifications: [],
        positions: [],
      };
      console.log(newWerker);
      return dbHelpers.addWerker(newWerker);
    })
    .then(werker => res.json(201, werker))
    .catch(err => errorHandler(err, res));
});

/**
 * PATCH /werkers/:werkerId
 * expects any number of changed values according to {@link dbHelpers#updateWerker}
 */
app.patch('/werkers/:werkerId', (req, res) => {
  const { werkerId } = req.params;
  const settings = req.body;
  if (settings.address) {
    return geocode(settings.address)
      .then(({ lat, lon }) => {
        settings.lat = lat;
        settings.long = lon;
        return reverseGeocode(lat, lon);
      })
      .then(address => dbHelpers.updateWerker(werkerId, Object.assign(settings, { address })))
      .then(updatedWerker => res.status(204).send())
      .catch(err => errorHandler(err, res));
  }
  return dbHelpers.updateWerker(werkerId, settings)
    .then(updatedWerker => res.status(204).send())
    .catch(err => errorHandler(err, res));
});

app.put('/werkers/login', (req, res) => {
  const newJWT = req.body;
  return getProfile(newJWT)
    .then((profile) => {
      console.log(profile);
      return models.Werker.findOne({
        where: {
          email: profile.emailAddresses[0].value,
        },
      });
    })
    .then(werker => res.status(201).json(werker))
    .catch(err => errorHandler(err, res));
});

// ----MAKER---- //

/**
 * PUT /makers
 * expects body with the following properties:
 *  name
 *  url_photo
 *  email
 *  phone
 * creates new resource in db
 * sends back new db record
 */

app.put('/makers', (req, res) => {
  console.log(req.body);
  const newJWT = req.body;
  // oauth2Client.credentials = newJWT;
  return getProfile(newJWT)
    .then((profile) => {
      console.log(profile);
      const newMaker = {
        name: profile.names ? profile.names[0].displayName : '',
        email: profile.emailAddresses ? profile.emailAddresses[0].value : '',
        url_photo: profile.photos ? profile.photos[0].url : '',
        phone: profile.phoneNumbers ? profile.phoneNumbers[0].value : '', // this is a guess!
      };
      console.log(newMaker);
      return models.Maker.upsert(newMaker, { returning: true });
    })
    .then(maker => res.json(201, maker))
    .catch(err => errorHandler(err, res));
});

app.put('/makers/login', (req, res) => {
  const newJWT = req.body;
  return getProfile(newJWT)
    .then((profile) => {
      console.log(profile);
      return models.Maker.findOne({
        where: {
          email: profile.emailAddresses[0].value,
        },
      });
    })
    .then(maker => res.json(201, Object.assign(maker, { type: 'maker' })))
    .catch(err => res.json(201, 'bad credentials'));
});

// get a maker's profile
app.get('/makers/:makerId', (req, res) => {
  models.Maker.findOne({ where: { id: req.params.makerId } })
    .then(maker => res.json(201, maker))
    .catch((err) => {
      console.error(err);
      res.send(500, 'Something went wrong!');
    });
});

// ----SHIFT---- //

// WERKER-FACING //

// get list of shifts by terms
app.get('/werkers/:werkerId/shifts', async (req, res) => {
  const shifts = await dbHelpers.getShiftsByTerm(req.query).catch(err => errorHandler(err, res));
  return res.status(200).json(shifts);
});

// gets all shifts a werker is eligible for based on positions
app.get('/werkers/:werkerId/shifts/available', async (req, res) => {
  const { werkerId } = req.params;
  const shifts = await dbHelpers.getShiftsForWerker(werkerId).catch(err => errorHandler(err, res));
  return res.status(200).json(shifts);
});

// histOrUpcoming is either 'history' or 'upcoming'
app.get('/werkers/:werkerId/shifts/:histOrUpcoming', async (req, res) => {
  const { werkerId, histOrUpcoming } = req.params;
  const shifts = await dbHelpers.getAcceptedShifts(werkerId, histOrUpcoming)
    .catch(err => errorHandler(err, res));
  return res.status(200).json(shifts);
});

// get all shifts werker is invited to
app.get('/werkers/:werkerId/invitations', async (req, res) => {
  const { werkerId } = req.params;
  const shifts = await dbHelpers.getInvitedShifts(werkerId).catch(err => errorHandler(err, res));
  return res.status(200).json(shifts);
});

// MAKER-FACING //

// app.get('/allshifts', (req, res) => {
//   dbHelpers.getAllShifts()
//     .then(shifts => res.status(200).json(shifts));
// });

/**
 * PUT /shifts
 * expects body with the following properties:
 *  MakerId
 *  name
 *  start
 *  end
 *  address
 *  description
 *  positions[]
 *   position is obj with:
 *   position
 *   payment_amnt
 *   payment_type
 */
app.put('/shifts', async (req, res) => {
  const { body } = req;
  body.positions = body.positions.map((position) => {
    const digit = /\d/.exec(Object.keys(position)[1])[0];
    console.log(digit);
    return {
      position: position[`position${digit}`],
      payment_amnt: position[`payment_amnt${digit}`],
      payment_type: position[`payment_type${digit}`],
    };
  });
  const { lat, lon } = await geocode(body.address);
  body.address = await reverseGeocode(lat, lon);
  body.lat = lat;
  body.long = lon;
  const shift = await dbHelpers.createShift(body)
    .catch(err => errorHandler(err, res));
  res.status(201).json(shift);
});

app.delete('/shifts/:shiftId', (req, res) => {
  const { shiftId } = req.params;
  return dbHelpers.deleteShift(shiftId)
    .then(() => res.send(204))
    .catch((err) => {
      console.error(err);
      res.status(500).send('unable to delete');
    });
});

// get all applications to a maker's shifts
app.get('/makers/:makerId/applications', async (req, res) => {
  const { makerId } = req.params;
  const werkers = await dbHelpers.getApplicationsForShifts(makerId)
    .catch(err => errorHandler(err, res));
  console.log(werkers);
  return res.status(200).json(werkers);
});

// get all unfulfilled shifts of a maker
app.get('/makers/:makerId/unfulfilled', async (req, res) => {
  const { makerId } = req.params;
  const shifts = await dbHelpers.getUnfulfilledShifts(makerId)
    .catch(err => errorHandler(err, res));
  return res.status(200).json(shifts);
});

// get all fulfilled shifts for a maker
// histOrUpcoming is either 'history' or 'upcoming'
app.get('/makers/:makerId/fulfilled/:histOrUpcoming', async (req, res) => {
  const { makerId, histOrUpcoming } = req.params;
  const shifts = await dbHelpers.getFulfilledShifts(makerId, histOrUpcoming)
    .catch(err => errorHandler(err, res));
  return res.status(200).json(shifts);
});

// MAKER/WERKER //

app.get('/favorites', (req, res) => {
  const { id, type } = req.query;
  return dbHelpers.getFavorites(id, type)
    .then(faves => res.status(200).json(faves))
    .catch(err => errorHandler(err));
});

app.put('/favorites', (req, res) => {
  const { makerId, werkerId, type } = req.body;
  return dbHelpers.addFavorite(makerId, werkerId, type)
    .then(fave => res.status(201).json(fave))
    .catch(err => errorHandler(err, res));
});

app.delete('/favorites', (req, res) => {
  const { makerId, werkerId, type } = req.body;
  return dbHelpers.deleteFavorite(makerId, werkerId, type)
    .then(deleted => res.status(201).json(deleted))
    .catch(err => errorHandler(err, res));
});

// get detailed shift info by Id for maker and werker
app.get('/shifts/:shiftId', async (req, res) => {
  const { shiftId } = req.params;
  // TODO check helper function name
  const shift = await dbHelpers.getShiftsById(shiftId).catch(err => errorHandler(err, res));
  return res.status(200).json(shift);
});

// apply or invite for shift
// applyOrInvite must be string "apply" or "invite"
app.put('/shifts/:shiftId/:applyOrInvite/:werkerId/:positionName', (req, res) => {
  const {
    shiftId,
    applyOrInvite,
    werkerId,
    positionName,
  } = req.params;
  dbHelpers.applyOrInviteForShift(shiftId, werkerId, positionName, applyOrInvite)
    .then(() => {
      res.send(201);
    })
    .catch((error) => {
      console.log(error, 'unable to apply');
      res.status(500).send('unable to apply');
    });
});

// accept or decline shift
app.patch('/shifts/:shiftId/application/:werkerId/:status', (req, res) => {
  const { shiftId, werkerId, status } = req.params;
  dbHelpers.acceptOrDeclineShift(shiftId, werkerId, status)
    .then(() => {
      res.send(204);
    })
    .catch((error) => {
      console.log(error, 'unable to accept/decline');
      res.status(500).send('unable to accept/decline');
    });
});

app.put('/shifts/:shiftId/:werkerId/rating/:type/:rating', async (req, res) => {
  const {
    shiftId,
    werkerId,
    rating,
    type,
  } = req.params;
  const newRating = await dbHelpers.rateShift(shiftId, werkerId, rating, type).catch(err => errorHandler(err, res));
  return res.send(201, newRating);
});

app.put('/auth', (req, res) => {
  const { tokens } = google;
});

const port = process.env.PORT || 4000;
// models.sequelize.sync();

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
