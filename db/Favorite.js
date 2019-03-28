module.exports = (sequelize, DataTypes) => {
  const Favorite = sequelize.define('Favorite', {
    type: DataTypes.STRING, // either 'maker' or 'werker'
  });

  Favorite.associate = (models) => {
    Favorite.belongsTo(models.Werker);
    Favorite.belongsTo(models.Maker);
  };
  return Favorite;
};
