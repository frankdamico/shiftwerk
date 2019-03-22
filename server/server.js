/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
// TODO need to make sure this is the correct path for dbHelpers
const dbHelpers = require('../dbHelpers/dbHelpers.js');
// const oauth2Client = new google.auth.OAuth2(
//   '347712232584-9dv95ud3ilg9bk7vg8i0biqav62fh1q7.apps.googleusercontent.com',
//   'WBbo3VF1_r9zsOovnfdi0h1Z',
// );
const { geocode, reverseGeocode } = require('../apiHelpers/tomtom');
const { models } = require('../db/index');
const twilio = require('../apiHelpers/twilio');


const app = express();
app.use(bodyParser.json());
app.use(cors());


const errorHandler = (err, res) => {
  console.error(err);
  res.send(500, 'Something went wrong!');
};

const appendAddressToShift = async (shift, sequelizeInstance) => {
  const address = await reverseGeocode(shift.lat, shift.long);
  console.log(address);
  if (!sequelizeInstance) {
    return Object.assign(shift, { address });
  }
  // eslint-disable-next-line no-param-reassign
  shift.dataValues.address = address;
  return shift;
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
  dbHelpers.getWerkerProfile(req.params.werkerId)
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
 * expects body with following properties:
 *  name_first
 *  name_last
 *  email
 *  url_photo
 *  bio
 *  phone
 *  last_minute *default false
 *  certifications[] *optional
 *  positions[] *optional
 * creates new resource in db
 * sends back new db record
 */

app.put('/werkers', (req, res) => {
  dbHelpers.addWerker(req.body)
    .then(newWerker => res.json(201, newWerker))
    .catch((err) => {
      console.error(err);
      res.send(500, 'Something went wrong!');
    });
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
  models.Maker.create(req.body)
    .then(newMaker => res.json(201, newMaker))
    .catch((err) => {
      console.error(err);
      res.send(500, 'Something went wrong!');
    });
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
app.get('/shifts', async (req, res) => {
  const shifts = await dbHelpers.getShiftsByTerm(req.query).catch(err => errorHandler(err, res));
  const shiftsWithAddress = await Promise.all(shifts
    .map(shift => appendAddressToShift(shift, false))).catch(err => errorHandler(err, res));
  return res.status(200).json(shiftsWithAddress);
});

// gets all shifts a werker is eligible for based on positions
app.get('/werkers/:werkerId/shifts/available', async (req, res) => {
  const { werkerId } = req.params;
  const shifts = await dbHelpers.getShiftsForWerker(werkerId).catch(err => errorHandler(err, res));
  const shiftsWithAddress = await Promise.all(shifts
    .map(shift => appendAddressToShift(shift))).catch(err => errorHandler(err, res));
  return res.status(200).json(shiftsWithAddress);
});

// get all shifts a werker is eligible for based on positions
app.get('/werkers/:werkerId/shifts/available', async (req, res) => {
  const { werkerId } = req.params;
  const shifts = await dbHelpers.getShiftsForWerker(werkerId).catch(err => errorHandler(err, res));
  console.log(shifts);
  const shiftsWithAddress = await Promise.all(shifts
    .map(shift => appendAddressToShift(shift, false))).catch(err => errorHandler(err, res));
  return res.status(200).json(shiftsWithAddress);
});

// histOrUpcoming is either 'history' or 'upcoming'
app.get('/werkers/:werkerId/shifts/:histOrUpcoming', async (req, res) => {
  const { werkerId, histOrUpcoming } = req.params;
  const shifts = dbHelpers.getAcceptedShifts(werkerId, histOrUpcoming)
    .catch(err => errorHandler(err, res));
  const shiftsWithAddress = await Promise.all(shifts
    .map(shift => appendAddressToShift(shift, false))).catch(err => errorHandler(err, res));
  return res.status(200).json(shiftsWithAddress);
});

// get all shifts werker is invited to
app.get('/werkers/:werkerId/invitations', async (req, res) => {
  const { werkerId } = req.params;
  const shifts = await dbHelpers.getInvitedShifts(werkerId).catch(err => errorHandler(err, res));
  const shiftsWithAddress = await Promise.all(shifts
    .map(shift => appendAddressToShift(shift, false))).catch(err => errorHandler(err, res));
  return res.status(200).json(shiftsWithAddress);
});

// MAKER-FACING //

/**
 * PUT /shifts
 * expects body with the following properties:
 *  MakerId
 *  name
 *  time_date
 *  duration
 *  address
 *  description
 *  positions[]
 *   position is obj with:
 *   position
 *   payment_amnt
 *  payment_type
 */
app.put('/shifts', async (req, res) => {
  const { body } = req;
  const { lat, lon } = await geocode(body.address);
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
  const shiftsWithAddress = await Promise.all(shifts
    .map(shift => appendAddressToShift(shift, false))).catch(err => errorHandler(err, res));
  return res.status(200).json(shiftsWithAddress);
});

// get all fulfilled shifts for a maker
// histOrUpcoming is either 'history' or 'upcoming'
app.get('/makers/:makerId/fulfilled/:histOrUpcoming', async (req, res) => {
  const { makerId, histOrUpcoming } = req.params;
  const shifts = await dbHelpers.getFulfilledShifts(makerId, histOrUpcoming)
    .catch(err => errorHandler(err, res));
  const shiftsWithAddress = await Promise.all(shifts
    .map(shift => appendAddressToShift(shift, false))).catch(err => errorHandler(err, res));
  return res.status(200).json(shiftsWithAddress);
});

// MAKER/WERKER //

// get detailed shift info by Id for maker and werker
app.get('/shifts/:shiftId', async (req, res) => {
  const { shiftId } = req.params;
  // TODO check helper function name
  const shift = await dbHelpers.getShiftsById(shiftId).catch(err => errorHandler(err, res));
  const shiftWithAddress = await appendAddressToShift(shift);
  console.log(shiftWithAddress);
  return res.status(200).json(shiftWithAddress);
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
