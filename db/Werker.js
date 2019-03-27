module.exports = (sequelize, DataTypes) => {
  const Werker = sequelize.define('Werker', {
    google_id: { type: DataTypes.STRING, unique: true },
    name_first: DataTypes.STRING,
    name_last: DataTypes.STRING,
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    url_photo: { type: DataTypes.STRING, allowNull: false },
    bio: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    phone: DataTypes.STRING,
    last_minute: { type: DataTypes.BOOLEAN, defaultValue: false },
    lat: DataTypes.NUMERIC,
    long: DataTypes.NUMERIC,
    address: DataTypes.STRING,
    cache_rating: DataTypes.NUMERIC,
  });

  Werker.associate = (models) => {
    Werker.belongsToMany(models.Position, {
      through: 'WerkerPosition',
    });
    Werker.belongsToMany(models.Shift, {
      through: 'WerkerShift',
    });
    Werker.belongsToMany(models.Certification, {
      through: models.WerkerCertification,
    });
  };
  return Werker;
};
