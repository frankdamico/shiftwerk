// HAVE NOT TESTED - ONCE VM INSTANCE RUNNING, CONNECT TO DB
// SET PORT, UPDATE .ENV, AND TEST - frank
const Sequelize = require('sequelize');

// const sequelize = new Sequelize('process.env.DBNAME', 'process.env.DBUSERNAME', 'process.env.DBPASSWORD', {
//   host: 'process.env.DBHOST',
//   dialect: 'postgres',
//   pool: {
//     max: 5,
//     min: 1,
//     acquire: 30000,
//     idle: 10000,
//   },
// });

const sequelize = new Sequelize(`postgres://${process.env.DBUSERNAME}:${process.env.DBPASSWORD}@${process.env.DBHOST}:5432/postgres`);
// change made
const models = {
  Shift: sequelize.import('./Shift'),
  Werker: sequelize.import('./Werker'),
  ShiftPosition: sequelize.import('./ShiftPosition'),
  Position: sequelize.import('./Position'),
  PaymentType: sequelize.import('./PaymentType'),
  Maker: sequelize.import('./Maker'),
  Certification: sequelize.import('./Certification'),
  WerkerCertification: sequelize.import('./WerkerCertification'),
  Favorite: sequelize.import('./Favorite'),
  Rating: sequelize.import('./Rating'),
  InviteApply: sequelize.import('./InviteApply'),

};

Object.keys(models).forEach((modelName) => {
  if ('associate' in models[modelName]) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

sequelize.authenticate()
  .then(() => {
    console.log(`Connected to DB on ${process.env.DBHOST}`);
  })
  .catch(err => console.log(`Unable to connect because ${err}`));

sequelize.sync().then(() => { console.log('created'); });
module.exports.models = models;
module.exports.sequelize = sequelize;
