module.exports = (sequelize, DataTypes) => {
  const Maker = sequelize.define('Maker', {
    google_id: { type: DataTypes.STRING, unique: true },
    access_token: DataTypes.STRING,
    refresh_token: DataTypes.STRING,
    name: { type: DataTypes.STRING, unique: true, allowNull: false },
    url_photo: { type: DataTypes.STRING, allowNull: false },
    phone: DataTypes.STRING,
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    cache_rating: DataTypes.NUMERIC,
  });

  return Maker;
};
