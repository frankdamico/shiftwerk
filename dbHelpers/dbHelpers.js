/* eslint-disable no-confusing-arrow */
/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
// const sequelize = require('sequelize');
const geolib = require('geolib');
const db = require('../db/index');

/**
 * Filters any number of shifts by distance from werker
 *
 * @param {number} distance - maximum distance in miles
 * @param {object} werkerPos - werker's current position
 * @param {number} werkerPos.latitude
 * @param {number} werkerPos.longitude
 * @param {object[]} shifts - array of models from DB
 * @return {object[]} - filtered array of Shift models
 */
const filterByDistance = (distance, werkerPos, shifts) => {
  const meters = distance * 1609.344;
  return shifts.filter((shift) => {
    const shiftPos = {
      latitude: shift.lat,
      longitude: shift.long,
    };
    return geolib.getDistance(werkerPos, shiftPos) <= meters;
  });
};

// WERKER

/**
 * gets the average of ratings received by werker
 *
 * @param {number} id - Werker id from DB
 */
const addRatingToWerker = werker => db.sequelize.query(`
SELECT AVG(rating) FROM "Ratings" r
WHERE r."WerkerId"=${werker.id} AND r.type='werker'`)
  .spread(rating => Object.assign(werker, { rating }));

/**
 * attaches a found werker's certifications and positions
 *
 * @param {Object[]} werkers - Array of werker objects from SQL query
 * @returns {Promise<Object[]>} - Modified input array
 */

const appendCertsRatingsAndPositionsToWerkers = werkers => Promise.all(werkers.map(werker => db.sequelize.query(`
      SELECT c.*, wc.*
      FROM "Certifications" c
      INNER JOIN "WerkerCertifications" wc
      ON c.id=wc."CertificationId"
      INNER JOIN "Werkers" w
      ON w.id=wc."WerkerId"
      WHERE w.id=?`, { replacements: [werker.id] })
  .spread(certifications => Object.assign(werker, { certifications }))
  .then(werkerWithCerts => db.sequelize.query(`
      SELECT p.position
      FROM "Positions" p
      INNER JOIN "WerkerPosition" wp
      ON p.id=wp."PositionId"
      INNER JOIN "Werkers" w
      ON w.id=wp."WerkerId"
      WHERE w.id=?`, { replacements: [werkerWithCerts.id] })
    .spread(positions => Object.assign(werkerWithCerts, { positions }))
    .then(werkerWithCertsAndPositions => addRatingToWerker(werkerWithCertsAndPositions)))));

/**
 * adds any number of certifications to a werker
 *
 * @param {Object} werker - werker model instance
 * @param {Object[]} certifications
 * @param {string} certifications.name
 * @param {string} certifications.url_photo
 */
const bulkAddCertificationToWerker = (werker, certifications) => Promise.all(certifications
  .map(certification => db.models.Certification.upsert(certification, { returning: true })
    // eslint-disable-next-line no-unused-vars
    .spread(newCert => db.models.WerkerCertification.upsert({
      WerkerId: werker.id,
      CertificationId: newCert.id,
      url_Photo: certification.url_Photo,
    }, {
      returning: true,
    }))))
  .then(() => werker);

/**
 * adds any number of new positions to db and werker
 *
 * @param {Object} werker - werker model instance
 * @param {Object[]} positions
 * @param {string} positions.position
 */
const bulkAddPositionToWerker = (werker, positions) => Promise.all(positions
  .map(position => db.models.Position.upsert(position, { returning: true })
    .spread(newPosition => newPosition.addWerker(werker))))
  .then(() => werker);

/**
 * adds new werker to DB, including certifications and positions
 *
 * @param {Object} info
 * @param {string} info.access_token
 * @param {string} info.refresh_token
 * @param {string} info.name_first
 * @param {string} info.name_last
 * @param {string} info.email
 * @param {string} info.url_photo
 * @param {string} info.bio
 * @param {string} info.phone
 * @param {boolean} info.last_minute
 * @param {Object[]} info.certifications
 * @param {string} info.certifications.cert_name
 * @param {string} info.certifications.url_Photo
 * @param {Object[]} info.positions
 * @param {string} info.positions.position
 */
const addWerker = (info) => {
  const werkerProps = {
    access_token: info.access_token,
    refresh_token: info.refresh_token,
    name_first: info.name_first,
    name_last: info.name_last,
    email: info.email,
    url_photo: info.url_photo,
    phone: info.phone,
  };
  return db.models.Werker.upsert(werkerProps, {
    returning: true,
  })
    .catch((err) => {
      if (err.message === 'Validation error') {
        return db.models.Werker.upsert(werkerProps,
          {
            returning: true,
          });
      }
      return new Error('Something went wrong');
    })
    .spread(newWerker => info.certifications
      ? bulkAddCertificationToWerker(newWerker, info.certifications)
      : new Promise(resolve => resolve(newWerker))
        .then(() => info.positions
          ? bulkAddPositionToWerker(newWerker, info.positions)
          : new Promise(resolve => resolve(newWerker))));
};

/**
 * updates Werker entry in DB
 *
 * @param {number} werkerId
 * @param {object} info - new values
 * @param {string} [info.name_first]
 * @param {string} [info.name_last]
 * @param {string} [info.email]
 * @param {string} [info.phone]
 * @param {string} [info.bio]
 * @param {object[]} [info.certifications]
 * @param {string} [info.certifications.cert_name]
 * @param {string} [info.certifications.url_Photo]
 * @param {object[]} [info.positions]
 * @param {string} [info.positions.position]
 * @param {number} [info.lat]
 * @param {number} [info.long]
 * @param {string} [info.address]
 */
const updateWerker = (werkerId, info) => db.models.Werker.update(info, {
  where: {
    id: werkerId,
  },
  returning: true,
})
  .spread(updatedWerker => info.certifications
    ? bulkAddCertificationToWerker(updatedWerker, info.certifications)
    : new Promise(resolve => resolve(updatedWerker))
      .then(() => info.positions
        ? bulkAddPositionToWerker(updatedWerker, info.positions)
        : new Promise(resolve => resolve(updatedWerker))));

/**
 * updates Maker entry in DB
 *
 * @param {number} makerId
 * @param {object} info - new values
 * @param {string} [info.name]
 * @param {string} [info.email]
 * @param {string} [info.phone]
 * @param {string} [info.bio]
 * @param {string} [info.certifications.url_Photo]
 */
const updateMaker = (makerId, info) => db.models.Maker.update(info, {
  where: {
    id: makerId,
  },
  returning: true,
});

/**
 * Function to search for shifts by various terms
 *
 * @param {object} terms - an object with search terms
 * @param {string} terms.position - required position
 * @param {number} terms.proximity - maximum distance, in miles (default 3)
 * @param {number} terms.payment_amnt - minimum pay to accept
 * @param {string} terms.payment_type - payment type to restrict results to
 * @param {number} werkerId - for proximity calculation
 */
const getShiftsByTerm = async (terms, werkerId) => {
  const searchTerms = terms;
  const werker = await db.models.Werker.findOne({
    where: {
      id: werkerId,
    },
  });
  if (terms.position) {
    const position = await db.models.Position.findOne({
      where: {
        position: terms.position,
      },
    });
    searchTerms.position = position.dataValues.id;
  }
  const conditions = {
    position: terms.position ? `sp."PositionId" = ${terms.position}` : 'sp."PositionId" IS NOT NULL',
    payment_amnt: terms.payment_amnt ? `sp.payment_amnt >= ${terms.payment_amnt}` : 'sp.payment_amnt IS NOT NULL',
    payment_type: terms.payment_type ? `s.payment_type = ${terms.payment_type}` : 'sp.payment_type IS NOT NULL',
  };
  return db.sequelize.query(`
  SELECT s.*, p.position, sp.payment_type, sp.payment_amnt FROM "Shifts" s
  INNER JOIN "ShiftPositions" sp
  ON s.id=sp."ShiftId"
  INNER JOIN "Positions" p
  ON p.id=sp."PositionId"
  WHERE ${conditions.position} AND ${conditions.payment_amnt} AND ${conditions.payment_type} AND sp.filled=false`)
    .spread(shifts => shifts)
    // filterByDistance((terms.proximity || 3), {
    // latitude: werker.lat,
    // longitude: werker.long,
  // }, shifts))
    .catch(err => console.error(err));
};

/**
 * gets all werkers eligible for a shift by their listed positions
 * executes raw SQL query for convenience (sometimes it's just easier!)
 *
 * @param {number} id - shift ID from db
 * @returns {Promise<Object[]>} - array containing array of obj results
 * and object describing query
 */
const getWerkersForShift = id => db.sequelize.query(`
SELECT w.*
FROM "Werkers" w
INNER JOIN "WerkerPosition" wp
  ON w.id=wp."WerkerId"
INNER JOIN "Positions" p
  ON p.id=wp."PositionId"
INNER JOIN "ShiftPositions" sp
  ON p.id=sp."PositionId"
WHERE sp."ShiftId"=?`, { replacements: [id] })
  .spread(fetchedWerkers => appendCertsRatingsAndPositionsToWerkers(fetchedWerkers));

/**
 * gets all werkers with a specific position
 * executes raw SQL query for convenience (sometimes it's just easier!)
 *
 * @param {string} position - the position name by which to search
 */

const getWerkersByPosition = position => db.sequelize.query(`
  SELECT w.*
    FROM "Werkers" w
  INNER JOIN "WerkerPosition" wp
    ON w.id=wp."WerkerId"
  INNER JOIN "Positions" p
    ON p.id=wp."PositionId"
  WHERE p.position=?`, { replacements: [position] })
  .spread(fetchedWerkers => appendCertsRatingsAndPositionsToWerkers(fetchedWerkers));

/**
 * Function to invite a werker to a shift - creates a new invitation
 * @param {number} shiftId - the id of the shift that the werker will be invited to
 * @param {object} data - the data needed to create the new invitation
 */
const inviteWerker = (shiftId, data) => db.models.InviteApply.create({
  idWerker: data.idWerker,
  idShift: shiftId,
  idPosition: data.idPosition,
  status: data.status,
  expiration: data.expiration,
  type: data.type,
});

/**
 * Function to get a user profile
 * @param {object} data - object containing the user's id
 */
const getWerkerProfile = id => db.models.Werker.findOne({
  where: { id },
  include: [
    {
      model: db.models.Certification,
      attributes: [
        'cert_name',
      ],
    },
    {
      model: db.models.Position,
      attributes: [
        'position',
      ],
    },
  ],
});

// WERKER/MAKER //

/**
 * creates a new "favorites" entry in the DB, either maker->werker or werker->maker
 *
 * @param {number} makerId - id from DB
 * @param {number} werkerId - id from DB
 * @param {string} type - either 'werker' or 'maker'
 */
const addFavorite = (makerId, werkerId, type) => db.models.Favorite.findOrCreate({
  where: {
    MakerId: makerId,
    WerkerId: werkerId,
    type,
  },
}).spread(favorite => favorite);

/**
 * removes a favorite from DB
 *
 * @param {number} makerId - id from DB
 * @param {number} werkerId - id from DB
 * @param {string} type - either 'werker' or 'maker'
 */
const deleteFavorite = (makerId, werkerId, type) => db.models.Favorite.destroy({
  where: {
    MakerId: makerId,
    WerkerId: werkerId,
    type,
  },
});

/**
 * retrieves all favorites for a given user
 *
 * @param {number} id - either werker or maker ID from DB
 * @param {string} type - either 'werker' or 'maker'
 */
const getFavorites = (id, type) => {
  const propToFind = type[0].toUpperCase().concat(type.slice(1).concat('Id'));
  return db.models.Favorite.findAll({
    where: {
      [propToFind]: id,
      type,
    },
  });
};

// SHIFT

/**
 * Adds an array of items to Positions table or updates if they exist
 * @param {Object} positions - key: position, val: string, key: payment_amnt, val: Number
 */
const bulkAddNewPositionsToShift = (shift, positions) => Promise.all(positions
  .map(position => db.models.Position.upsert(position, { returning: true })
    .then(([newPosition, updated]) => db.models.ShiftPosition.upsert({
      ShiftId: shift.id,
      PositionId: newPosition.id,
      payment_amnt: position.payment_amnt,
      payment_type: position.payment_type,
    }, {
      returning: true,
    }))));
/**
 * Function used to create a new shift
 * @param {string} name - the name of the shift
 * @param {date} start - the start date of the shift
 * @param {number} duration - the duration of the shift in minutes
 * @param {number} lat - the latitude of the shift
 * @param {number} long - the longitude of the shift
 * @param {string} description - a short description of the shift
 * @param {Array<object>} positions - has properties "position" and "payment_amnt"
 * @param {string} payment_type - what format the pay is in, e.g. cash, digital, check
 */
const createShift = ({
  MakerId,
  name,
  start,
  end,
  lat,
  long,
  address,
  description,
  positions,
}) => db.models.Shift.create({
  MakerId,
  name,
  start,
  end,
  lat,
  long,
  address,
  description,
})
  .then(newShift => bulkAddNewPositionsToShift(newShift, positions));

/**
 * Function used to apply for a shift - updates the shift status to 'Pending'
 *
 * @param {number} shiftId - the id of the shift to be applied to
 * @param {number} werkerId - the id of the werker applying or being invited to the shift
 * @param {number} positionName - the name of the position applied or invited to
 * @param {string} inviteOrApply - either "invite" or "apply" signifying
 * invitation from maker or application from werker
 */

const applyOrInviteForShift = (shiftId, werkerId, positionName, inviteOrApply) => db.sequelize.query(`
SELECT sp.id FROM "ShiftPositions" sp INNER JOIN "Positions" p ON p.id=sp."PositionId" INNER JOIN "Shifts" s ON s.id=sp."ShiftId" WHERE p.position='${positionName}' AND s.id=${shiftId}`)
  .spread((shiftPositions) => {
    console.log(shiftPositions);
    return db.sequelize.query(`
INSERT INTO "InviteApplies" ("WerkerId",
"ShiftPositionId", 
"createdAt", 
"updatedAt",
"type") VALUES (${werkerId}, ${shiftPositions[0].id}, 'now', 'now', '${inviteOrApply}')`);
  });

/**
 * Function used to accept shifts - updates the shift status to 'accept' or 'decline'
 * @param {number} shiftId - the id of the shift to be accepted
 * @param {number} werkerId - the id of the werker accepting the shift
 */
const acceptOrDeclineShift = (shiftId, werkerId, status) => db.models.InviteApply.update({
  status,
}, {
  where: {
    WerkerId: werkerId,
  },
  include: [
    {
      model: db.models.ShiftPosition,
      where: {
        ShiftId: shiftId,
      },
    },
  ],
  returning: true,
}).then((updated) => {
  const updatedEntry = updated[1][0].dataValues;
  if (status === 'decline') {
    return updatedEntry;
  }
  return db.sequelize.query(`
  UPDATE "ShiftPositions" sp
  SET filled=true
  WHERE sp."id"=${updatedEntry.ShiftPositionId}`)
    .spread(updatedShiftPosition => updatedShiftPosition);
});

/**
 * Function to search for shifts by keywords
 * @param {object} data - an object with search terms
 */
const getShiftsBySearchTermsAndVals = data => db.models.ShiftPosition.find({
  where: { id: data.PositionId, payment_amnt: data.payment_amnt },
  include: [db.models.Shift, db.models.Position],
  limit: 10,
});

/**
 * Function to get a shift by it's id
 * @param {number} shiftId - id of the shift to be found
 */
const getShiftsById = shiftId => db.models.Shift.findOne({
  where: {
    id: shiftId,
  },
});

/**
 * gets ten shifts from the DB, sorted by start
 * and offset by a given amount
 *
 * @param {Number} offset - number of pages (by ten) to offset entries by
 *
 * @returns {Promise<any[]>} - array of ten sequelize model instances
 */
const getAllShifts = (offset = 0) => db.models.Shift.findAll({
  // limit: 10,
  // offset: offset * 10,
  order: [['start', 'DESC']],
  include: [
    {
      model: db.models.Maker,
      attributes: [
        'name',
      ],
    },
    {
      model: db.models.Position,
      through: {
        attributes: [
          'payment_amnt',
          'position',
          'filled',
        ],
      },
    },
    {
      model: db.models.Werker,
      through: {
        attributes: [
          'id',
          'name',
        ],
      },
    },
  ],
});

const getMakerRating = id => db.sequelize.query(`
SELECT AVG(rating) FROM "Ratings" r
INNER JOIN "Shifts" s
ON s.id=r."ShiftId"
WHERE s."MakerId"=${id} AND r.type='maker'`)
  .spread(rating => rating);

/**
 * appends maker info to any number of shifts
 *
 * @param {Object[]} shifts - Shift instances from DB
 */
const appendMakerRatingPositionToShifts = shifts => Promise.all(shifts.map(shift => db.sequelize.query(`
  SELECT m.* from "Makers" m, "Shifts" s
  WHERE m.id=s."MakerId" AND s.id=${shift.id}`)
  .then(maker => Object.assign(shift, { maker: maker[0] }))
  .then(augmentedShift => getMakerRating(augmentedShift.MakerId)
    .then(rating => Object.assign(augmentedShift, { rating }))
    .then(shiftWithRating => db.sequelize.query(`
      SELECT sp.*, p.*
      FROM "ShiftPositions" sp
      INNER JOIN "Positions" p
      ON p.id=sp."PositionId"
      WHERE sp."ShiftId"=${shiftWithRating.id}`)
      .spread(positions => Object.assign(shiftWithRating, { positions }))))));

/**
 * fetches all shifts werker is eligible for based on positions
 *
 * @param {number} id - the werker ID from DB
 */
const getShiftsForWerker = id => db.sequelize.query(`
SELECT s.*
FROM "Shifts" s
INNER JOIN "ShiftPositions" sp
  ON s.id=sp."ShiftId"
INNER JOIN "Positions" p
  ON p.id=sp."PositionId"
INNER JOIN "WerkerPosition" wp
  ON p.id=wp."PositionId"
INNER JOIN "Werkers" w
  ON w.id=wp."WerkerId"
WHERE w.id=? LIMIT 10`, { replacements: [id] })
  .spread(shifts => appendMakerRatingPositionToShifts(shifts));

/**
 * deletes a shift from the database by id
 *
 * @param {number} id
 * @returns {Promise<number>} - number of models destroyed
 */
const deleteShift = id => db.models.Shift.destroy({
  where: { id },
});

/**
 * gets all shifts a werker has been invited to with status 'pending'
 *
 * @param {number} id - ID of werker fro DB
 */
const getInvitedShifts = id => db.sequelize.query(`
SELECT s.* FROM "Shifts" s
INNER JOIN "ShiftPositions" sp
ON s.id = sp."ShiftId"
INNER JOIN "InviteApplies" ia
ON sp.id=ia."ShiftPositionId"
INNER JOIN "Werkers" w
ON w.id = ia."WerkerId"
WHERE ia.type='invite' AND w.id=${id} AND ia.status='pending'`)
  .spread(shifts => appendMakerRatingPositionToShifts(shifts));

/**
 * gets all shifts a werker has accepted, either past or future
 *
 * @param {number} id - werker id from DB
 * @param {string} histOrUpcoming - either 'history' or 'upcoming'
 * @returns {Promise<Object[]>} - An array of Shift objects
 */

const getAcceptedShifts = (id, histOrUpcoming) => {
  const option = histOrUpcoming === 'history'
    ? '<'
    : '>';
  return db.sequelize.query(`
  SELECT s.* FROM "Shifts" s
  INNER JOIN "ShiftPositions" sp
  ON s.id=sp."ShiftId"
  INNER JOIN "InviteApplies" ia
  ON sp.id=ia."ShiftPositionId"
  INNER JOIN "Werkers" w
  ON w.id=ia."WerkerId"
  WHERE w.id=? AND s.start ${option} 'now'
  LIMIT 10`, { replacements: [id] })
    .spread(shifts => appendMakerRatingPositionToShifts(shifts));
};

/**
 * receives werker and shift info for every pending application
 *
 * @param {number} id - maker ID from DB
 */

const getApplicationsForShifts = id => db.sequelize.query(`
SELECT DISTINCT w.*, s.name as "shiftName", s.id as "shiftId", p.position FROM "Werkers" w
INNER JOIN "InviteApplies" ia
ON w.id=ia."WerkerId"
INNER JOIN "ShiftPositions" sp
ON sp.id=ia."ShiftPositionId"
INNER JOIN "Shifts" s
ON s.id=sp."ShiftId"
INNER JOIN "Makers" m
ON m.id=s."MakerId"
INNER JOIN "Positions" p
ON sp."PositionId"=p.id
WHERE ia.status = 'pending' AND ia.type = 'apply' AND m.id=${id}`)
  .spread(fetchedWerkers => appendCertsRatingsAndPositionsToWerkers(fetchedWerkers));

/**
 * Gets all shifts that have some unfilled positions for a maker
 *
 * @param {number} id - maker ID from DB
 */

const getUnfulfilledShifts = id => db.sequelize.query(`
SELECT DISTINCT s.* FROM "Shifts" s
INNER JOIN "ShiftPositions" sp
ON s.id=sp."ShiftId"
WHERE sp.filled=false AND s."MakerId"=?
LIMIT 10`, { replacements: [id] })
  .spread(shifts => appendMakerRatingPositionToShifts(shifts));

/**
 * Gets all shifts that have no unfilled positions for a maker
 *
 * @param {number} id - maker ID from DB
 */

const getFulfilledShifts = (id, histOrUpcoming) => {
  const option = histOrUpcoming === 'history'
    ? '<'
    : '>';
  return db.sequelize.query(`
  SELECT DISTINCT s.* FROM "Shifts" s
  WHERE NOT EXISTS (
    SELECT * FROM "ShiftPositions" sp
    WHERE s.id=sp."ShiftId" AND sp.filled=false
  ) AND s."MakerId"=? AND s.start ${option} 'now'
  LIMIT 10`, { replacements: [id] })
    .spread(shifts => appendMakerRatingPositionToShifts(shifts));
};

const getAllWerkersOnShift = shiftId => db.sequelize.query(`
SELECT w.* FROM "Werkers" w
INNER JOIN "InviteApplies" ia
ON w.id=ia."WerkerId"
INNER JOIN "ShiftPositions" sp
ON sp.id=ia."ShiftPositionId"
WHERE sp."ShiftId" = ${shiftId}`)
  .spread(werkers => werkers);

const getMakerByShiftId = id => db.models.Maker.findOne({
  include: [{
    model: db.models.Shift,
    where: {
      id,
    },
  }],
});

const rateShift = (shiftId, werkerId, rating, type) => db.sequelize.query(`
INSERT INTO "Ratings" ("ShiftId", "WerkerId", rating, type, "createdAt", "updatedAt") VALUES (${shiftId}, ${werkerId}, ${rating}, '${type}', 'now', 'now')`);

module.exports = {
  getWerkerProfile,
  inviteWerker,
  getShiftsByTerm,
  getShiftsBySearchTermsAndVals,
  acceptOrDeclineShift,
  createShift,
  applyOrInviteForShift,
  getShiftsById,
  getAllShifts,
  deleteShift,
  bulkAddNewPositionsToShift,
  addWerker,
  bulkAddCertificationToWerker,
  bulkAddPositionToWerker,
  updateWerker,
  updateMaker,
  getWerkersForShift,
  getWerkersByPosition,
  getShiftsForWerker,
  getAcceptedShifts,
  getInvitedShifts,
  getApplicationsForShifts,
  getUnfulfilledShifts,
  getFulfilledShifts,
  getMakerByShiftId,
  rateShift,
  addFavorite,
  deleteFavorite,
  getFavorites,
  getAllWerkersOnShift,
};
