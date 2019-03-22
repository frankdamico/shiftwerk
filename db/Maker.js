module.exports = (sequelize, DataTypes) => {
  const Maker = sequelize.define('Maker', {
    name: { type: DataTypes.STRING, unique: true, allowNull: false },
    url_photo: { type: DataTypes.STRING, allowNull: false },
    phone: DataTypes.STRING,
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    cache_rating: DataTypes.NUMERIC,
  });

  return Maker;
};
