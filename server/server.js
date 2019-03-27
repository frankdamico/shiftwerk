/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const dbHelpers = require('../dbHelpers/dbHelpers.js');
const { verifyToken, checkLogin, checkUser } = require('../auth/auth');

const { geocode, reverseGeocode } = require('../apiHelpers/tomtom');
const { models } = require('../db/index');
const twilio = require('../apiHelpers/twilio');
const { getGoogleProfile } = require('../apiHelpers/google');


const app = express();
app.use(bodyParser.json());
app.use(cors());

app.get('/shifts', (req, res) => {
  dbHelpers.getAllShifts()
    .then(shifts => res.status(200).json(shifts));
});

const errorHandler = (err, res) => {
  console.error(err);
  return res.send(500, 'Something went wrong!');
};

// app.use(verifyToken);

// app.put('/werkers', (req, res, next) => {
//   req.user.type = 'werker';
//   return getGoogleProfile(req, res, next);
// });

/**
 * PUT /werkers
 * expects JWT as body
 * creates new resource in db
 * sends back new db record
 */

app.put('/werkers', (req, res) => dbHelpers.addWerker(req.user)
  .then(werker => res.json(201, werker))
  .catch(err => errorHandler(err, res)));

// app.put('/makers', (req, res, next) => {
//   req.user.type = 'maker';
//   return getGoogleProfile(req, res, next);
// });

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
  console.log(req.user);
  return models.Maker.upsert(req.user, {
    returning: true,
  })
    .spread(maker => res.json(201, maker))
    .catch(err => errorHandler(err, res));
});

// app.use(checkLogin);

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

// get a maker's profile
app.get('/makers/:makerId', (req, res) => {
  models.Maker.findOne({ where: { id: req.params.makerId } })
    .then(maker => res.json(201, maker))
    .catch((err) => {
      console.error(err);
      res.send(500, 'Something went wrong!');
    });
});

// get list of shifts by terms
app.get('/werkers/:werkerId/shifts', async (req, res) => {
  const shifts = await dbHelpers.getShiftsByTerm(req.query).catch(err => errorHandler(err, res));
  return res.status(200).json(shifts);
});

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

// get detailed shift info by Id for maker and werker
app.get('/shifts/:shiftId', async (req, res) => {
  const { shiftId } = req.params;
  // TODO check helper function name
  const shift = await dbHelpers.getShiftsById(shiftId).catch(err => errorHandler(err, res));
  return res.status(200).json(shift);
});

// app.use(checkUser);

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

// app.put('/werkers/login', (req, res) => {
//   const newJWT = req.body;
//   return getProfile(newJWT)
//     .then((profile) => {
//       console.log(profile);
//       return models.Werker.findOne({
//         where: {
//           email: profile.emailAddresses[0].value,
//         },
//       });
//     })
//     .then(werker => res.status(201).json(werker))
//     .catch(err => errorHandler(err, res));
// });

// ----MAKER---- //

// app.put('/makers/login', (req, res) => {
//   const newJWT = req.body;
//   return getProfile(newJWT)
//     .then((profile) => {
//       console.log(profile);
//       return models.Maker.findOne({
//         where: {
//           email: profile.emailAddresses[0].value,
//         },
//       });
//     })
//     .then(maker => res.json(201, Object.assign(maker, { type: 'maker' })))
//     .catch(err => res.json(201, 'bad credentials'));
// });

// ----SHIFT---- //

// WERKER-FACING //

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

const port = process.env.PORT || 4000;
// models.sequelize.sync();

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
